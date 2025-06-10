#!/usr/bin/env node
import { Server as McpServer } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { z } from "zod";
// apiClient.ts から型と関数をインポート
import {
  getCurrentWeather,
  getForecast,
  type CurrentWeatherResponse, // 型も必要に応じてインポート
  type ForecastResponse,       // 型も必要に応じてインポート
} from "./apiClient.js";

// MCPツールの入力スキーマ (これはサーバー側で必要なので残す)
const GetCurrentWeatherInputSchema = z.object({
  city: z
    .string()
    .min(1, "都市名は必須です。")
    .describe("天気を取得したい都市名"),
});
type GetCurrentWeatherInput = z.infer<typeof GetCurrentWeatherInputSchema>;

const GetForecastInputSchema = z.object({
  city: z
    .string()
    .min(1, "都市名は必須です。")
    .describe("天気予報を取得したい都市名"),
  days: z
    .number()
    .min(1)
    .max(5)
    .optional()
    .default(3)
    .describe("予報日数（1～5日、デフォルト3日）"),
});
type GetForecastInput = z.infer<typeof GetForecastInputSchema>;

// APIキーチェックやaxiosインスタンス生成は apiClient.ts に移管済み
// getCurrentWeather および getForecast 関数も apiClient.ts からインポート

// --- MCPサーバーとツールの定義 ---
// コメント: get_current_weatherツールの定義
const getCurrentWeatherTool = {
  name: "get_current_weather",
  inputSchema: GetCurrentWeatherInputSchema,
  execute: async (input: GetCurrentWeatherInput) => {
    // ...既存のロジックをここに移動...
    const { city } = input;
    const weatherData = await getCurrentWeather(city);
    if ("error" in weatherData) {
      return {
        content: [{ type: "text", text: `エラー: ${weatherData.error}` }],
        isError: true,
      };
    }
    const responseText = JSON.stringify(
      {
        city: weatherData.name,
        temperature: weatherData.main.temp,
        description: weatherData.weather[0]?.description || "情報なし",
        humidity: weatherData.main.humidity,
        windSpeed: weatherData.wind.speed,
        updatedAt: new Date(weatherData.dt * 1000).toISOString(),
      },
      null,
      2
    );
    return { content: [{ type: "text", text: responseText }] };
  },
};

// コメント: get_forecastツールの定義
const getForecastTool = {
  name: "get_forecast",
  inputSchema: GetForecastInputSchema,
  execute: async (input: GetForecastInput) => {
    // ...既存のロジックをここに移動...
    const { city, days } = input;
    const forecastData = await getForecast(city, days);
    if ("error" in forecastData) {
      return {
        content: [{ type: "text", text: `エラー: ${forecastData.error}` }],
        isError: true,
      };
    }
    const formattedForecasts = forecastData.list.map((item) => ({
      dateTime: item.dt_txt,
      temperature: item.main.temp,
      description: item.weather[0]?.description || "情報なし",
      precipitation_probability:
        item.pop !== undefined ? `${(item.pop * 100).toFixed(0)}%` : "N/A",
    }));
    const responseText = JSON.stringify(
      { city: forecastData.city.name, forecasts: formattedForecasts },
      null,
      2
    );
    return { content: [{ type: "text", text: responseText }] };
  },
};

// コメント: サーバー作成時にtools配列でツールを登録
const server = new McpServer(
  {
    name: "weather-server-tutorial",
    version: "0.1.0",
    description: "天気情報を提供するMCPサーバー (チュートリアル用)",
  },
  {
    capabilities: {
      tools: { getCurrentWeatherTool, getForecastTool },
    },
  }
);

// --- MCPサーバーとツールの定義ここまで ---

// --- サーバー起動処理 ---
async function main() {
  const transport = new StdioServerTransport();
  try {
    await server.connect(transport);
    console.log(
      "Weather MCP Server is running. Available tools: get_current_weather, get_forecast"
    );
  } catch (error) {
    console.error("MCP Server failed to connect:", error);
    process.exit(1);
  }
}

main();
// --- サーバー起動処理ここまで ---
