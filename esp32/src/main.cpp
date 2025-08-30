#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
// --- DHT Sensor ---
#define DHTPIN 4 // GPIO pin where the DHT sensor is connected
#define SOIL_PIN 6       // Soil moisture (Analog)
#define WATER_PIN 7      // Water level (Analog)
#define DHTTYPE DHT11 // DHT11 or DHT22
DHT dht(DHTPIN, DHTTYPE);

// --- WiFi credentials ---
const char* ssid = "YOUR-SSID";
const char* password = "YOUR-PASSWORD";

// --- MQTT Broker (Raspberry Pi running Mosquitto) ---
const char* mqtt_server = "YOUR-MQTT-BROKER-IP";
const int mqtt_port = 1883;

// --- Clients ---
WiFiClient espClient;
PubSubClient client(espClient);

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
}

void reconnect() {
  // Loop until connected
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    if (client.connect("ESP32Client")) {
      Serial.println("connected!");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" retry in 5 seconds");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);

  dht.begin();
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // Publish DHT sensor data every 2 seconds
  static unsigned long lastMsg = 0;
  if (millis() - lastMsg > 2000) {
    lastMsg = millis();
    float h = dht.readHumidity();
    float t = dht.readTemperature();
    int soilValue = analogRead(SOIL_PIN);
    int waterValue = analogRead(WATER_PIN);

    if (isnan(h) || isnan(t)) {
      Serial.println("Failed to read from DHT sensor!");
      return;
    }
    String payload = String("{\"temperature\":") + t + ",\"humidity\":" + h + ",\"soil_moisture\":" + soilValue + ",\"water_level\":" + waterValue + "}";
    client.publish("esp32/sensor", payload.c_str());
    Serial.print("Published: ");
    Serial.println(payload);
  }
}


