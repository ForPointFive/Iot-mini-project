#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>

// --- DHT Sensor ---
#define DHTPIN 4
#define SOIL_PIN 6
#define WATER_PIN 7
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// --- WiFi credentials ---
const char* ssid = "Atonality";
const char* password = "12345678";

// --- MQTT Broker ---
const char* mqtt_server = "10.12.218.32";
const int mqtt_port = 1883;

// --- Topics ---
const char* tempTopic = "esp32/sensor/temperature";
const char* humTopic = "esp32/sensor/humidity";
const char* soilTopic = "esp32/sensor/soilMoisture";
const char* waterTopic = "esp32/sensor/waterLevel";

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

void publishSensors(float t, float h, int soilValue, int waterValue) {
  // Temperature
  if (!isnan(t)) {
    String payload = String("{\"temperature\":") + t + "}";
    if(client.publish(tempTopic, payload.c_str())) {
      Serial.println("Temperature published: " + payload);
    } else {
      Serial.println("Temperature publish failed");
    }
  }

  // Humidity
  if (!isnan(h)) {
    String payload = String("{\"humidity\":") + h + "}";
    if(client.publish(humTopic, payload.c_str())) {
      Serial.println("Humidity published: " + payload);
    } else {
      Serial.println("Humidity publish failed");
    }
  }

  // Soil Moisture
  String payloadSoil = String("{\"soilMoisture\":") + soilValue + "}";
  if(client.publish(soilTopic, payloadSoil.c_str())) {
    Serial.println("Soil Moisture published: " + payloadSoil);
  } else {
    Serial.println("Soil Moisture publish failed");
  }

  // Water Level
  String payloadWater = String("{\"waterLevel\":") + waterValue + "}";
  if(client.publish(waterTopic, payloadWater.c_str())) {
    Serial.println("Water Level published: " + payloadWater);
  } else {
    Serial.println("Water Level publish failed");
  }
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  static unsigned long lastMsg = 0;
  if (millis() - lastMsg > 5000) {
    lastMsg = millis();

    float h = dht.readHumidity();
    float t = dht.readTemperature();
    int soilValue = analogRead(SOIL_PIN);
    int waterValue = analogRead(WATER_PIN);

    if (isnan(h)) {
      Serial.println("Failed to read Humidity!");
    }
    if (isnan(t)) {
      Serial.println("Failed to read Temperature!");
    }

    // Publish all sensors (NaN values will be ignored inside publishSensors)
    publishSensors(t, h, soilValue, waterValue);
  }
}