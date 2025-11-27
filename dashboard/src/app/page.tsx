"use client";
import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

import { MqttMessage } from "../types/mqtt";
import { Prediction } from "@/types/prediction";
import { getPrediction } from "@/services/prediction";

type SensorValue = { timestamp: number; value: number };
type ChartDataPoint = {
  time: string;
  date: string;
  fullTimestamp: string;
  value: number;
  rawTimestamp: number;
};
type StatusInfo = { status: string; color: string };

// Utility Functions
const formatTimestamp = (timestamp: any): string => {
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

const formatTimeOnly = (timestamp: any): string => {
  if (!timestamp) return "N/A";
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
};

const formatDateOnly = (timestamp: any): string => {
  if (!timestamp) return "N/A";
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const getRelayStatusColor = (state: string): string => {
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

const getWaterLevelStatus = (level: number): StatusInfo => {
  if (level > 70) return { status: "High", color: "text-blue-600" };
  if (level > 30) return { status: "Medium", color: "text-yellow-600" };
  return { status: "Low", color: "text-red-600" };
};

const getSoilMoistureStatus = (moisture: number): StatusInfo => {
  if (moisture > 60) return { status: "Wet", color: "text-blue-600" };
  if (moisture > 30) return { status: "Moderate", color: "text-green-600" };
  return { status: "Dry", color: "text-red-600" };
};

const getLatestSensorValue = (sensorData: Record<string, SensorValue>): SensorValue => {
  const entries = Object.entries(sensorData);
  if (entries.length === 0) return { value: 0, timestamp: 0 };
  
  const latest = entries.reduce((latest, current) => {
    return current[1].timestamp > latest[1].timestamp ? current : latest;
  });
  
  return latest[1];
};

const getLatestControllerData = (controllerData: Record<string, any>) => {
  const entries = Object.entries(controllerData);
  if (entries.length === 0) return null;
  
  const latest = entries.reduce((latest, current) => {
    return current[1].timestamp > latest[1].timestamp ? current : latest;
  });
  
  return latest[1];
};

const getLastTenDataFromSensor = (records: Record<string, SensorValue>): ChartDataPoint[] => {
  const entries = Object.entries(records);
  const sortedEntries = entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
  return sortedEntries.slice(-10).map(([key, obj]) => ({
    time: formatTimeOnly(obj.timestamp),
    date: formatDateOnly(obj.timestamp),
    fullTimestamp: formatTimestamp(obj.timestamp),
    value: obj.value,
    rawTimestamp: obj.timestamp
  }));
};

const getDateRange = (chartData: ChartDataPoint[]): string => {
  if (chartData.length === 0) return "No data";
  const firstDate = chartData[0]?.date;
  const lastDate = chartData[chartData.length - 1]?.date;
  return firstDate === lastDate ? firstDate : `${firstDate} - ${lastDate}`;
};

// Components
const ErrorDisplay = ({ error }: { error: string }) => (
  <main className="flex min-h-screen flex-col items-center justify-center p-24">
    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
      <p className="font-bold">Error</p>
      <p>{error}</p>
    </div>
  </main>
);

const NoDataDisplay = () => (
  <main className="flex min-h-screen flex-col items-center justify-center p-24">
    <p className="text-lg">No data available</p>
  </main>
);

const LeafAnalysisCard = ({ 
  controllerData, 
  prediction 
}: { 
  controllerData: any; 
  prediction: Prediction | null; 
}) => {
  if (!controllerData?.image_base64) return null;

  return (
    <div className="mb-6">
      <div className="bg-white rounded-lg shadow-sm p-6 w-full">
        <h2 className="text-lg font-semibold text-gray-700 mb-4 text-center">
          Leaf Analysis
        </h2>
        <div className="flex gap-6 h-96">
          {/* Image Section - 70% width */}
          <div className="flex-[7]">
            <img
              src={`data:image/png;base64,${controllerData.image_base64}`}
              alt="Leaf"
              className="w-full h-full object-cover rounded"
            />
          </div>
          
          {/* Prediction Section - 30% width */}
          <div className="flex-[3] flex flex-col justify-center">
            {prediction ? (
              <div className={`p-4 rounded border h-full flex flex-col justify-center ${
                prediction.predict === 'healthy' 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <span className={`text-lg font-semibold mb-4 text-center block ${
                  prediction.predict === 'healthy' 
                    ? 'text-green-700' 
                    : 'text-red-700'
                }`}>
                  {prediction.predict.replace('_', ' ').toUpperCase()}
                </span>
                <div className="space-y-3">
                  {Object.entries(prediction.probs).map(([key, prob]) => {
                    const percentageNum = (prob as number) * 100;
                    const percentageStr = percentageNum.toFixed(1);
                    const isHighest = prediction.predict === key;
                    return (
                      <div key={key} className="flex flex-col">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm text-gray-600 capitalize">
                            {key.replace('_', ' ')}
                          </span>
                          <span className="text-sm text-gray-700 font-medium">
                            {percentageStr}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className={`h-3 rounded-full transition-all duration-300 ${
                              isHighest ? 'bg-blue-500' : 'bg-gray-400'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, percentageNum))}%` } as React.CSSProperties}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 rounded border border-gray-200 h-full flex items-center justify-center">
                <span className="text-lg text-gray-500">Loading...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const SensorCard = ({ 
  title, 
  value, 
  unit, 
  icon, 
  borderColor, 
  textColor, 
  status, 
  extra 
}: {
  title: string;
  value: number | string;
  unit?: string;
  icon: string;
  borderColor: string;
  textColor: string;
  status?: StatusInfo;
  extra?: string;
}) => (
  <div className={`bg-white rounded-lg shadow-sm p-2 border-l-2 ${borderColor}`}>
    <div className="flex items-center">
      <div className="flex-1">
        <p className="text-xs text-gray-600 mb-1">{title}</p>
        <p className={`text-lg font-bold ${textColor}`}>
          {value}{unit}
        </p>
        {status && (
          <p className={`text-xs font-medium ${status.color}`}>
            {status.status}
          </p>
        )}
        {extra && (
          <p className="text-xs text-gray-500">{extra}</p>
        )}
      </div>
      <span className="text-lg ml-1">{icon}</span>
    </div>
  </div>
);

const SensorChart = ({ 
  title, 
  data, 
  color, 
  unit 
}: {
  title: string;
  data: ChartDataPoint[];
  color: string;
  unit: string;
}) => (
  <div className="bg-white rounded-lg shadow-sm p-4">
    <h3 className="text-lg font-semibold text-gray-800 mb-1">{title}</h3>
    <p className="text-xs text-gray-500 mb-4">Date: {getDateRange(data)}</p>
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="time" 
          fontSize={10}
          angle={-45}
          textAnchor="end"
          height={50}
        />
        <YAxis fontSize={12} />
        <Tooltip 
          formatter={(value: any) => [value, `${title}`]}
          labelFormatter={(label: any) => {
            const dataPoint = data.find(d => d.time === label);
            return dataPoint ? dataPoint.fullTimestamp : label;
          }}
        />
        <Line 
          type="monotone" 
          dataKey="value" 
          stroke={color} 
          strokeWidth={2}
          dot={{ fill: color, strokeWidth: 2, r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

export default function Home() {
  const [data, setData] = useState<MqttMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [currentImageBase64, setCurrentImageBase64] = useState<string | null>(null);

  // Data fetching logic
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get<MqttMessage>("/api/sensor-data");
      console.log("[DEBUG] Fetched sensor data:", {
        timestamp: new Date().toISOString(),
        dataKeys: Object.keys(response.data?.mqtt || {}),
        hasController: !!response.data?.mqtt?.controller
      });
      setData(response.data);
    } catch (err) {
      setError("Failed to fetch data");
      console.error("[ERROR] Failed to fetch sensor data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Prediction logic
  const handlePrediction = useCallback(async (imageBase64: string) => {
    try {
      console.log("[DEBUG] Starting leaf prediction...");
      const response = await getPrediction(imageBase64);
      if (response) {
        setPrediction(response);
        const confidenceValues = Object.values(response.probs) as number[];
        console.log("[DEBUG] Prediction completed:", {
          predict: response.predict,
          confidence: Math.max(...confidenceValues) * 100
        });
      }
    } catch (error) {
      console.error("[ERROR] Prediction failed:", error);
    }
  }, []);

  // Setup data fetching interval
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Handle prediction when image changes
  useEffect(() => {
    const controllerData = getLatestControllerData(data?.mqtt?.controller || {});
    
    if (controllerData?.image_base64) {
      if (currentImageBase64 !== controllerData.image_base64) {
        console.log("[DEBUG] New image detected, updating prediction...");
        setCurrentImageBase64(controllerData.image_base64);
        setPrediction(null);
        handlePrediction(controllerData.image_base64);
      }
    } else if (currentImageBase64) {
      console.log("[DEBUG] No image available, clearing prediction...");
      setCurrentImageBase64(null);
      setPrediction(null);
    }
  }, [data, currentImageBase64, handlePrediction]);

  // Early returns for error and loading states
  if (error) return <ErrorDisplay error={error} />;
  if (!data || !data.mqtt) return <NoDataDisplay />;

  // Process sensor data
  const sensor = data.mqtt;
  const temperatureData = getLatestSensorValue(sensor.temperature || {});
  const humidityData = getLatestSensorValue(sensor.humidity || {});
  const soilMoistureData = getLatestSensorValue(sensor.soilmoisture || {});
  const waterLevelData = getLatestSensorValue(sensor.waterlevel || {});
  const controllerData = getLatestControllerData(sensor.controller || {});
  
  // Prepare chart data
  const temperatureChartData = getLastTenDataFromSensor(sensor.temperature || {});
  const humidityChartData = getLastTenDataFromSensor(sensor.humidity || {});
  const soilMoistureChartData = getLastTenDataFromSensor(sensor.soilmoisture || {});
  const waterLevelChartData = getLastTenDataFromSensor(sensor.waterlevel || {});
  
  // Get status information
  const waterLevel = getWaterLevelStatus(waterLevelData.value);
  const soilMoisture = getSoilMoistureStatus(soilMoistureData.value);

  console.log("[DEBUG] Rendering dashboard with data:", {
    temperature: temperatureData.value,
    humidity: humidityData.value,
    soilMoisture: soilMoistureData.value,
    waterLevel: waterLevelData.value,
    hasControllerData: !!controllerData,
    hasPrediction: !!prediction
  });

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            IoT Dashboard
          </h1>
          <p className="text-sm text-gray-600">
            Real-time monitoring system
          </p>
        </div>
        
        {/* Sensor Cards Section */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <SensorCard
            title="Temp"
            value={temperatureData.value}
            unit="°C"
            icon="🌡️"
            borderColor="border-red-400"
            textColor="text-red-600"
          />
          
          <SensorCard
            title="Humidity"
            value={humidityData.value}
            unit="%"
            icon="💧"
            borderColor="border-blue-400"
            textColor="text-blue-600"
          />
          
          <SensorCard
            title="Soil"
            value={soilMoistureData.value}
            unit="%"
            icon="🌱"
            borderColor="border-green-400"
            textColor="text-green-600"
            status={soilMoisture}
          />
          
          <SensorCard
            title="Water"
            value={waterLevelData.value}
            unit="%"
            icon="🚰"
            borderColor="border-cyan-400"
            textColor="text-cyan-600"
            status={waterLevel}
          />
          
          <div className="bg-white rounded-lg shadow-sm p-2 border-l-2 border-purple-400">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-xs text-gray-600 mb-1">Pump</p>
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getRelayStatusColor(controllerData?.relay_state || "off")} mb-1`}>
                  {(controllerData?.relay_state || "off").toUpperCase()}
                </span>
                <p className="text-xs text-gray-500">{controllerData?.relay_reason || "N/A"}</p>
              </div>
              <span className="text-lg ml-1">⚡</span>
            </div>
          </div>
          
          <SensorCard
            title="Last Start"
            value={formatTimestamp(controllerData?.last_relay_start_ts)}
            icon="📅"
            borderColor="border-indigo-400"
            textColor="text-gray-700"
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SensorChart
            title="Temperature (°C)"
            data={temperatureChartData}
            color="#ef4444"
            unit="°C"
          />
          
          <SensorChart
            title="Humidity (%)"
            data={humidityChartData}
            color="#3b82f6"
            unit="%"
          />
          
          <SensorChart
            title="Soil Moisture (%)"
            data={soilMoistureChartData}
            color="#10b981"
            unit="%"
          />
          
          <SensorChart
            title="Water Level (%)"
            data={waterLevelChartData}
            color="#06b6d4"
            unit="%"
          />
        </div>

        {/* Leaf Analysis Section */}
        <LeafAnalysisCard controllerData={controllerData} prediction={prediction} />

        {/* Auto-refresh indicator */}
        <div className="fixed bottom-0 right-0 bg-white border border-gray-200 rounded-tl-lg shadow-sm px-3 py-1 z-10">
          <p className="text-xs text-gray-500">
            Auto-refresh: 2s
          </p>
        </div>
      </div>
    </main>
  );
}