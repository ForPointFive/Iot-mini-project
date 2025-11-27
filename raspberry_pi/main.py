#!/usr/bin/env python3
import json, time, signal, sys, threading
import paho.mqtt.client as mqtt
import firebase_admin
from firebase_admin import credentials, db
from gpiozero import PWMLED, Button, OutputDevice

from camera_service import CameraService

# ====== CONFIG ======
SERVICE_ACCOUNT = "./serviceAccountKey.json"
DATABASE_URL    = "https://final-iot-project-3f0ec-default-rtdb.asia-southeast1.firebasedatabase.app/"

MQTT_HOST  = "0.0.0.0"
MQTT_PORT  = 1883
MQTT_TOPIC = "esp32/sensor/#"

PIN_R, PIN_G, PIN_B = 17, 27, 22
PIN_RELAY, PIN_BUTTON = 24, 23

LED_COMMON_ANODE = False
RELAY_ACTIVE_LOW = True

SOIL_ON_TH = 3500
RELAY_BURST_MS = 5000

# GLOBAL
last_controller_push = 0
CONTROLLER_COOLDOWN_MS = 10000   # 10 seconds

# ====== Firebase init ======
cred = credentials.Certificate(SERVICE_ACCOUNT)
firebase_admin.initialize_app(cred, {"databaseURL": DATABASE_URL})
base_ref = db.reference("mqtt")


# ====== Utils ======
def now_ms(): return int(time.time()*1000)
def log(*args): print(time.strftime("%H:%M:%S"), *args, flush=True)

def soil_to_percent(raw, wet=300, dry=3500):
    raw = max(min(raw, dry), wet)
    percent = (dry - raw) * 100 / (dry - wet)
    return round(percent, 1)

def water_pct(raw, min_val=0, max_val=4095):
    raw = max(min(raw, max_val), min_val)
    return round((raw - min_val) * 100 / (max_val - min_val), 1)

# ====== Camera Init ======
camera = CameraService(width=1280, height=720)


# ====== GPIO ======
led_r = PWMLED(PIN_R, frequency=1000)
led_g = PWMLED(PIN_G, frequency=1000)
led_b = PWMLED(PIN_B, frequency=1000)

def set_rgb01(r,g,b):
    if LED_COMMON_ANODE:
        led_r.value, led_g.value, led_b.value = 1-r,1-g,1-b
    else:
        led_r.value, led_g.value, led_b.value = r,g,b

relay = OutputDevice(PIN_RELAY, active_high=not RELAY_ACTIVE_LOW, initial_value=False)
button = Button(PIN_BUTTON, pull_up=True, bounce_time=0.03)


# ====== State ======
pump_on = False
last_relay_start_ts = 0
last_reason = "boot"
last_soil_value = None
_off_timer = None
latest_sensors = {}


# ====== Pump Control ======
def update_led_by_relay():
    if pump_on:
        set_rgb01(0,1,0)
    else:
        set_rgb01(1,0,0)

def _cancel_off_timer():
    global _off_timer
    if _off_timer:
        _off_timer.cancel()
        _off_timer = None

def _schedule_off(after_ms, reason_suffix):
    global _off_timer
    _cancel_off_timer()

    def _off():
        pump_set(False, reason=reason_suffix)

    _off_timer = threading.Timer(after_ms/1000, _off)
    _off_timer.daemon = True
    _off_timer.start()

def pump_set(state, reason="auto"):
    global pump_on, last_relay_start_ts, last_reason

    if state and not pump_on:
        relay.on()
        pump_on = True
        last_relay_start_ts = now_ms()
        last_reason = reason
        log(f"[PUMP] START reason={reason}")

        update_led_by_relay()
        _schedule_off(RELAY_BURST_MS, f"{reason}_timeout")

    elif not state and pump_on:
        relay.off()
        pump_on = False
        last_reason = reason
        log(f"[PUMP] STOP reason={reason}")

        _cancel_off_timer()
        update_led_by_relay()

# ====== Manual Button ======
def on_button_pressed():
    log("[BUTTON] Manual burst")
    pump_set(True, reason="manual_burst")

button.when_pressed = on_button_pressed

# ====== MQTT ======
def on_connect(client, userdata, flags, rc):
    log("MQTT connected:", rc)
    client.subscribe(MQTT_TOPIC, qos=1)

def on_message(client, userdata, msg):
    global last_soil_value

    # ---------------------------------------------
    # Parse topic & raw payload
    # ---------------------------------------------
    topic_part = msg.topic.split("/")[-1].lower()
    raw = msg.payload.decode("utf-8", errors="replace").strip()

    try:
        data_json = json.loads(raw)
        value = list(data_json.values())[0]
    except:
        value = raw

    ts = now_ms()

    # ---------------------------------------------
    # Convert BEFORE saving
    # ---------------------------------------------
    if "soil" in topic_part:
        value = soil_to_percent(value)  # replace raw ADC with percent

    elif "water" in topic_part:
        value = water_pct(value)        # replace raw ADC with percent

    # ---------------------------------------------
    # Save converted value to Firebase
    # ---------------------------------------------
    sensor_ref = db.reference(f"mqtt/{topic_part}")
    current_list = sensor_ref.get() or []

    current_list.append({
        "timestamp": ts,
        "value": value  # already converted here
    })

    sensor_ref.set(current_list)

    log(f"[FIREBASE] saved sensor {topic_part}={value}")

    # ---------------------------------------------
    # Auto pump (soil only)
    # ---------------------------------------------
    if topic_part in ("soil", "soilmoisture"):
        try:
            last_soil_value = float(value)
            if last_soil_value > SOIL_ON_TH:
                pump_set(True, reason="auto_soil_high")
        except:
            pass

    update_led_by_relay()

    # ---------------------------------------------
    # Push controller state (cooldown)
    # ---------------------------------------------
    global last_controller_push
    now_ts = now_ms()

    if now_ts - last_controller_push > CONTROLLER_COOLDOWN_MS:
        last_controller_push = now_ts

        def capture_and_push_controller():
            img_b64 = camera.capture_base64()
            ctrl_ref = db.reference("mqtt/controller")

            lst = ctrl_ref.get() or []
            lst.append({
                "timestamp": now_ms(),
                "relay_state": "on" if pump_on else "off",
                "relay_reason": last_reason,
                "last_relay_start_ts": last_relay_start_ts,
                "image_base64": img_b64
            })
            ctrl_ref.set(lst)

            log("[FIREBASE] controller state pushed")

        threading.Thread(target=capture_and_push_controller, daemon=True).start()

# ====== Cleanup ======
def cleanup_and_exit(*_):
    set_rgb01(0,0,0)
    pump_set(False, reason="shutdown")
    led_r.close(); led_g.close(); led_b.close()
    relay.close(); button.close()
    sys.exit(0)

signal.signal(signal.SIGINT, cleanup_and_exit)
signal.signal(signal.SIGTERM, cleanup_and_exit)


# ====== Main Loop ======
update_led_by_relay()

client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message
client.connect(MQTT_HOST, MQTT_PORT, 60)
client.loop_forever()