#!/usr/bin/env python3
import json, time, signal, sys, threading
import paho.mqtt.client as mqtt
import firebase_admin
from firebase_admin import credentials, db
from gpiozero import PWMLED, Button, OutputDevice

# ====== CONFIG ======
SERVICE_ACCOUNT = "./serviceAccountKey.json"
DATABASE_URL    = "YOUR-FIREBASE"

MQTT_HOST  = "0.0.0.0"
MQTT_PORT  = 1883
MQTT_TOPIC = "esp32/sensor"

PIN_R, PIN_G, PIN_B = 17, 27, 22
PIN_RELAY, PIN_BUTTON = 24, 23

LED_COMMON_ANODE = False
RELAY_ACTIVE_LOW = True

SOIL_ON_TH, SOIL_OFF_TH = 5000, 2500
WATER_MIN, WATER_MAX = 0, 4095

# ระยะเวลาติดรีเลย์แต่ละครั้ง (ms)
RELAY_BURST_MS = 5000

# ====== Firebase init ======
cred = credentials.Certificate(SERVICE_ACCOUNT)
firebase_admin.initialize_app(cred, {"databaseURL": DATABASE_URL})

def sanitize_topic(t: str) -> str:
    return (t.replace(".", "_").replace("#","_").replace("$","_")
             .replace("[","_").replace("]","_"))
topic_key = sanitize_topic(MQTT_TOPIC)
base_ref = db.reference(f"mqtt/{topic_key}")

# ====== Utils ======
def now_ms(): return int(time.time()*1000)
def log(*args): print(time.strftime("%H:%M:%S"), *args, flush=True)

# ====== GPIO ======
led_r = PWMLED(PIN_R, frequency=1000)
led_g = PWMLED(PIN_G, frequency=1000)
led_b = PWMLED(PIN_B, frequency=1000)

def set_rgb01(r: float, g: float, b: float):
    if LED_COMMON_ANODE:
        led_r.value, led_g.value, led_b.value = 1-r, 1-g, 1-b
    else:
        led_r.value, led_g.value, led_b.value = r, g, b

relay = OutputDevice(PIN_RELAY, active_high=not RELAY_ACTIVE_LOW, initial_value=False)
button = Button(PIN_BUTTON, pull_up=True, bounce_time=0.03)

# ====== State ======
pump_on = False
last_relay_start_ts = 0
last_reason = "boot"
last_soil_value = None
_off_timer: threading.Timer | None = None

def _cancel_off_timer():
    global _off_timer
    if _off_timer is not None:
        _off_timer.cancel()
        _off_timer = None

def _schedule_off(after_ms: int, reason_suffix: str):
    """ตั้งเวลาปิดรีเลย์อัตโนมัติ"""
    global _off_timer
    _cancel_off_timer()
    def _off():
        pump_set(False, reason=reason_suffix)
    _off_timer = threading.Timer(after_ms / 1000.0, _off)
    _off_timer.daemon = True
    _off_timer.start()

def pump_set(state: bool, reason: str = "auto"):
    global pump_on, last_relay_start_ts, last_reason
    if state and not pump_on:
        relay.on(); pump_on = True
        last_relay_start_ts = now_ms()
        last_reason = reason
        log(f"[PUMP] START  reason={reason} soil={last_soil_value} ts={last_relay_start_ts}")
        _schedule_off(RELAY_BURST_MS, reason_suffix=f"{reason}_timeout")
    elif (not state) and pump_on:
        relay.off(); pump_on = False
        last_reason = reason
        log(f"[PUMP] STOP   reason={reason} soil={last_soil_value} ts={now_ms()}")
        _cancel_off_timer()

# ====== Water-level → RGB gradient ======
def lerp(a,b,t): return a + (b-a)*t
def level_to_rgb01(level: float):
    if level <= WATER_MIN: return (1,0,0)
    if level >= WATER_MAX: return (0,0,1)
    mid = (WATER_MIN + WATER_MAX)/2
    if level <= mid:
        t = (level - WATER_MIN)/(mid - WATER_MIN + 1e-9)
        return (lerp(1,0,t), lerp(0,1,t), 0)
    else:
        t = (level - mid)/(WATER_MAX - mid + 1e-9)
        return (0, lerp(1,0,t), lerp(0,1,t))

# ====== Button: press = force burst ======
def on_button_pressed():
    log(f"[BUTTON] pressed -> force {RELAY_BURST_MS/1000}s")
    pump_set(True, reason="manual_burst")

button.when_pressed = on_button_pressed

# ====== MQTT callbacks ======
def on_connect(client, userdata, flags, rc):
    log("MQTT connected:", rc)
    client.subscribe(MQTT_TOPIC, qos=1)

def on_message(client, userdata, msg):
    global last_soil_value
    raw = msg.payload.decode("utf-8", errors="replace").strip()
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        payload = {"value": raw}

    soil = payload.get("soil_moisture")
    water = payload.get("water_level")

    try:
        last_soil_value = int(soil) if soil is not None else None
    except Exception:
        last_soil_value = None

    if water is not None:
        try:
            r,g,b = level_to_rgb01(float(water))
            set_rgb01(r,g,b)
        except Exception:
            pass

    if soil is not None:
        try:
            s = int(soil)
            if s > SOIL_ON_TH:
                pump_set(True, reason="auto_soil_high")
        except Exception:
            pass

    payload["relay_state"] = "on" if pump_on else "off"
    payload["relay_reason"] = last_reason
    payload["last_relay_start_ts"] = last_relay_start_ts
    data = {"payload": payload, "topic": msg.topic, "qos": msg.qos, "ts": now_ms()}
    base_ref.set(payload)
    log("Pushed payload:", payload)

# ====== Cleanup ======
def cleanup_and_exit(*_):
    set_rgb01(0,0,0)
    pump_set(False, reason="shutdown")
    led_r.close(); led_g.close(); led_b.close()
    relay.close(); button.close()
    sys.exit(0)

signal.signal(signal.SIGINT, cleanup_and_exit)
signal.signal(signal.SIGTERM, cleanup_and_exit)

# ====== Run ======
client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message
client.connect(MQTT_HOST, MQTT_PORT, 60)
client.loop_forever()