export interface MqttMessage {
  mqtt: {
    controller: Record<string, ControllerObject>;
    humidity: Record<string, SensorObject>;
    temperature: Record<string, SensorObject>;
    soilmoisture: Record<string, SensorObject>;
    waterlevel: Record<string, SensorObject>;
  };
}

export interface ControllerObject {
  image_base64: string;
  last_relay_start_ts: number;
  relay_reason: string;
  relay_state: "on" | "off";
  timestamp: number;
}

export interface SensorObject {
  timestamp: number;
  value: number;
}