#!/usr/bin/env node
import { Server as McpServer } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
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
// MCPツールの定義
const getCurrentWeatherTool = {
  name: "get_current_weather",
  description: "指定した都市の現在の天気を取得します",
  parameters: GetCurrentWeatherInputSchema,
  async execute(input: GetCurrentWeatherInput) {
    const { city } = input;
    const weatherData = await getCurrentWeather(city);
    if ("error" in weatherData) {
      throw new Error(`エラー: ${weatherData.error}`);
    }
    return {
      city: weatherData.name,
      temperature: weatherData.main.temp,
      description: weatherData.weather[0]?.description || "情報なし",
      humidity: weatherData.main.humidity,
      windSpeed: weatherData.wind.speed,
      updatedAt: new Date(weatherData.dt * 1000).toISOString()
    };
  }
};

const getForecastTool = {
  name: "get_forecast",
  description: "指定した都市の天気予報を取得します",
  parameters: GetForecastInputSchema,
  async execute(input: GetForecastInput) {
    const { city, days } = input;
    const forecastData = await getForecast(city, days);
    if ("error" in forecastData) {
      throw new Error(`エラー: ${forecastData.error}`);
    }
    const formattedForecasts = forecastData.list.map((item) => ({
      dateTime: item.dt_txt,
      temperature: item.main.temp,
      description: item.weather[0]?.description || "情報なし",
      precipitation_probability:
        item.pop !== undefined ? `${(item.pop * 100).toFixed(0)}%` : "N/A",
    }));
    return {
      city: forecastData.city.name,
      forecasts: formattedForecasts
    };
  }
};

const server = new McpServer(
  {
    name: "weather-server-tutorial",
    version: "0.1.0",
    description: "天気情報を提供するMCPサーバー (チュートリアル用)",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ツール一覧を返すハンドラーを登録
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_current_weather",
        description: "指定した都市の現在の天気を取得します",
        inputSchema: GetCurrentWeatherInputSchema,
      },
      {
        name: "get_forecast",
        description: "指定した都市の天気予報を取得します",
        inputSchema: GetForecastInputSchema,
      },
    ],
  };
});

// ツール実行のハンドラーを登録
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "get_current_weather": {
      const input = request.params.arguments as GetCurrentWeatherInput;
      const weatherData = await getCurrentWeather(input.city);
      if ("error" in weatherData) {
        throw new Error(`エラー: ${weatherData.error}`);
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              city: weatherData.name,
              temperature: weatherData.main.temp,
              description: weatherData.weather[0]?.description || "情報なし",
              humidity: weatherData.main.humidity,
              windSpeed: weatherData.wind.speed,
              updatedAt: new Date(weatherData.dt * 1000).toISOString()
            }, null, 2)
          }
        ]
      };
    }
    case "get_forecast": {
      const input = request.params.arguments as GetForecastInput;
      const forecastData = await getForecast(input.city, input.days);
      if ("error" in forecastData) {
        throw new Error(`エラー: ${forecastData.error}`);
      }
      const formattedForecasts = forecastData.list.map((item) => ({
        dateTime: item.dt_txt,
        temperature: item.main.temp,
        description: item.weather[0]?.description || "情報なし",
        precipitation_probability:
          item.pop !== undefined ? `${(item.pop * 100).toFixed(0)}%` : "N/A",
      }));
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              city: forecastData.city.name,
              forecasts: formattedForecasts
            }, null, 2)
          }
        ]
      };
    }
    default:
      throw new Error("Unknown tool name");
  }
});

// サーバー起動処理
async function main() {
  const transport = new StdioServerTransport();
  try {
    await server.connect(transport);
    // プロトコルメッセージと混ざらないように、サーバー起動メッセージは出力しない
  } catch (error) {
    console.error("MCP Server failed to connect:", error);
    process.exit(1);
  }
}

main();
// --- サーバー起動処理ここまで ---
