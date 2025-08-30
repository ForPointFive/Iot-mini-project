export interface MqttMessage {
  mqtt: {
    esp32: Esp32;
  };
}

export interface Esp32 {
  sensor: Sensor;
}

export interface Sensor {
  humidity: number;
  last_relay_start_ts: any;
  relay_state: string;
  relay_reason: string;
  soil_moisture: number;
  temperature: number;
  water_level: number;
}
