"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import { MqttMessage } from "../types/mqtt";
import { Spin } from "antd";
import { LoadingOutlined } from "@ant-design/icons";

export default function Home() {
  const [data, setData] = useState<MqttMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get<MqttMessage>("/api/sensor-data");
        console.log("Fetched data:", response.data);
        setData(response.data);
      } catch (err) {
        setError("Failed to fetch data");
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Fetch data every 2 seconds for real-time updates
    const interval = setInterval(fetchData, 2000);

    return () => clearInterval(interval);
  }, []);

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return "N/A";
    const date = new Date(timestamp);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
  };

  const getRelayStatusColor = (state: string) => {
    switch (state.toLowerCase()) {
      case "on":
      case "active":
        return "bg-green-100 text-green-800 border-green-300";
      case "off":
      case "inactive":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getWaterLevelStatus = (level: number) => {
    if (level > 70) return { status: "High", color: "text-blue-600" };
    if (level > 30) return { status: "Medium", color: "text-yellow-600" };
    return { status: "Low", color: "text-red-600" };
  };

  const getSoilMoistureStatus = (moisture: number) => {
    if (moisture > 60) return { status: "Wet", color: "text-blue-600" };
    if (moisture > 30) return { status: "Moderate", color: "text-green-600" };
    return { status: "Dry", color: "text-red-600" };
  };

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  if (!data || !data.mqtt) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <p className="text-lg">No data available</p>
      </main>
    );
  }

  const sensor = data.mqtt.esp32.sensor;
  const waterLevel = getWaterLevelStatus(sensor.water_level);
  const soilMoisture = getSoilMoistureStatus(sensor.soil_moisture);

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            IoT Sensor Dashboard
          </h1>
          <p className="text-lg text-gray-600">
            Real-time monitoring of your smart irrigation system
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Temperature Card */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-400">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-700">
                  Temperature
                </h3>
                <p className="text-3xl font-bold text-red-600">
                  {sensor.temperature}°C
                </p>
              </div>
              <div className="text-4xl">🌡️</div>
            </div>
          </div>

          {/* Humidity Card */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-400">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-700">
                  Humidity
                </h3>
                <p className="text-3xl font-bold text-blue-600">
                  {sensor.humidity}
                </p>
              </div>
              <div className="text-4xl">💧</div>
            </div>
          </div>

          {/* Soil Moisture Card */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-400">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-700">
                  Soil Moisture
                </h3>
                <p className="text-3xl font-bold text-green-600">
                  {sensor.soil_moisture}
                </p>
                <span className={`text-sm font-medium ${soilMoisture.color}`}>
                  {soilMoisture.status}
                </span>
              </div>
              <div className="text-4xl">🌱</div>
            </div>
          </div>

          {/* Water Level Card */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-cyan-400">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-700">
                  Water Level
                </h3>
                <p className="text-3xl font-bold text-cyan-600">
                  {sensor.water_level}
                </p>
                <span className={`text-sm font-medium ${waterLevel.color}`}>
                  {waterLevel.status}
                </span>
              </div>
              <div className="text-4xl">🚰</div>
            </div>
          </div>

          {/* Relay Status Card */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-400">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-700">
                  Pump Status
                </h3>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${getRelayStatusColor(
                    sensor.relay_state
                  )}`}
                >
                  {sensor.relay_state.toUpperCase()}
                </span>
                <p className="text-sm text-gray-600 mt-2">
                  Reason: {sensor.relay_reason}
                </p>
              </div>
              <div className="text-4xl">⚡</div>
            </div>
          </div>

          {/* Last Activity Card */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-indigo-400">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-700">
                  Last Pump Start
                </h3>
                <p className="text-sm text-gray-600">
                  {formatTimestamp(sensor.last_relay_start_ts)}
                </p>
              </div>
              <div className="text-4xl">📅</div>
            </div>
          </div>
        </div>

        {/* System Overview */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            System Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">
                Environmental Conditions
              </h3>
              <ul className="space-y-2">
                <li className="flex justify-between">
                  <span>Temperature:</span>
                  <span className="font-medium">{sensor.temperature}°C</span>
                </li>
                <li className="flex justify-between">
                  <span>Humidity:</span>
                  <span className="font-medium">{sensor.humidity}</span>
                </li>
                <li className="flex justify-between">
                  <span>Soil Moisture:</span>
                  <span className={`font-medium ${soilMoisture.color}`}>
                    {sensor.soil_moisture} ({soilMoisture.status})
                  </span>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">
                Irrigation System
              </h3>
              <ul className="space-y-2">
                <li className="flex justify-between">
                  <span>Water Level:</span>
                  <span className={`font-medium ${waterLevel.color}`}>
                    {sensor.water_level} ({waterLevel.status})
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>Pump Status:</span>
                  <span className="font-medium">{sensor.relay_state}</span>
                </li>
                <li className="flex justify-between">
                  <span>Activation Reason:</span>
                  <span className="font-medium">{sensor.relay_reason}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Auto-refresh indicator */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Data refreshes automatically every 2 seconds
          </p>
        </div>
      </div>
    </main>
  );
}
