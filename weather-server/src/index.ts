#!/usr/bin/env node
import { Server as McpServer } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  CallToolRequest,
  ReadResourceRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  getCurrentWeather,
  getForecast,
} from "./apiClient.js";

// APIレスポンスの型定義
type WeatherListItem = {
  dt_txt: string;
  main: {
    temp: number;
  };
  weather: Array<{
    description?: string;
  }>;
  pop?: number;
};

// MCPツールの入力スキーマ
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

// MCPサーバーとツールの定義
const getCurrentWeatherTool = {
  name: "get_current_weather",
  description: "指定した都市の現在の天気を取得します",
  parameters: GetCurrentWeatherInputSchema,
  async execute(input: GetCurrentWeatherInput) {
    const { city } = input;
    const result = await getCurrentWeather(city);
    if ("error" in result) {
      throw new Error(`エラー: ${result.error}`);
    }
    return {
      city: result.name,
      temperature: result.main.temp,
      description: result.weather[0]?.description || "情報なし",
      humidity: result.main.humidity,
      windSpeed: result.wind.speed,
      updatedAt: new Date(result.dt * 1000).toISOString()
    };
  }
};

const getForecastTool = {
  name: "get_forecast",
  description: "指定した都市の天気予報を取得します",
  parameters: GetForecastInputSchema,
  async execute(input: GetForecastInput) {
    const { city, days } = input;
    const result = await getForecast(city, days);
    if ("error" in result) {
      throw new Error(`エラー: ${result.error}`);
    }
    const formattedForecasts = result.list.map((item: WeatherListItem) => ({
      dateTime: item.dt_txt,
      temperature: item.main.temp,
      description: item.weather[0]?.description || "情報なし",
      precipitation_probability:
        item.pop !== undefined ? `${(item.pop * 100).toFixed(0)}%` : "N/A",
    }));
    return {
      city: result.city.name,
      forecasts: formattedForecasts
    };
  }
};

// リソーステンプレートの定義
const weatherResourceTemplate = {
  name: "weather",
  description: "都市の気象情報を提供するリソース",
  uriTemplate: "weather://{city}/{type}",
  parameters: {
    city: z.string(),
    type: z.enum(["current", "forecast"])
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
      tools: {
        get_current_weather: getCurrentWeatherTool,
        get_forecast: getForecastTool,
      },
      resources: {
        weather: weatherResourceTemplate,
      },
    },
  }
);

// リソース一覧を返すハンドラーを登録
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        name: "weather",
        description: "都市の気象情報を提供するリソース",
        uriTemplate: weatherResourceTemplate.uriTemplate,
        uri: "weather://tokyo/current"
      },
    ],
  };
});

// リソーステンプレート一覧を返すハンドラーを登録
server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
  return {
    resourceTemplates: [
      {
        name: "weather",
        description: "都市の気象情報を提供するリソース",
        uriTemplate: "weather://{city}/{type}",
        parameters: {
          city: {
            type: "string",
            description: "天気を取得したい都市名"
          },
          type: {
            type: "string",
            description: "取得する情報の種類（current または forecast）",
            enum: ["current", "forecast"]
          }
        },
        required: ["city", "type"]
      }
    ]
  };
});

// ツール一覧を返すハンドラーを登録
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_current_weather",
        description: "指定した都市の現在の天気を取得します",
        inputSchema: {
          type: "object",
          properties: {
            city: {
              type: "string",
              description: "天気を取得したい都市名",
              minLength: 1
            }
          },
          required: ["city"]
        },
      },
      {
        name: "get_forecast",
        description: "指定した都市の天気予報を取得します",
        inputSchema: {
          type: "object",
          properties: {
            city: {
              type: "string",
              description: "天気予報を取得したい都市名",
              minLength: 1
            },
            days: {
              type: "number",
              description: "予報日数（1～5日、デフォルト3日）",
              minimum: 1,
              maximum: 5,
              default: 3
            }
          },
          required: ["city"]
        },
      },
    ],
  };
});

// ツール実行のハンドラーを登録
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  switch (request.params.name) {
    case "get_current_weather": {
      const input = request.params.arguments as GetCurrentWeatherInput;
      const result = await getCurrentWeather(input.city);
      if ("error" in result) {
        throw new Error(`エラー: ${result.error}`);
      }
      return {
        _meta: {},
        content: [
          {
            type: "text",
            text: JSON.stringify({
              city: result.name,
              temperature: result.main.temp,
              description: result.weather[0]?.description || "情報なし",
              humidity: result.main.humidity,
              windSpeed: result.wind.speed,
              updatedAt: new Date(result.dt * 1000).toISOString()
            }, null, 2)
          }
        ]
      };
    }
    case "get_forecast": {
      const input = request.params.arguments as GetForecastInput;
      const result = await getForecast(input.city, input.days);
      if ("error" in result) {
        throw new Error(`エラー: ${result.error}`);
      }
      const formattedForecasts = result.list.map((item: WeatherListItem) => ({
        dateTime: item.dt_txt,
        temperature: item.main.temp,
        description: item.weather[0]?.description || "情報なし",
        precipitation_probability:
          item.pop !== undefined ? `${(item.pop * 100).toFixed(0)}%` : "N/A",
      }));
      return {
        _meta: {},
        content: [
          {
            type: "text",
            text: JSON.stringify({
              city: result.city.name,
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

// リソース読み取りのハンドラーを登録
server.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest) => {
  try {
    // URIのバリデーション
    if (!request.params.uri.startsWith('weather://')) {
      throw new Error('Invalid URI scheme: must start with weather://');
    }

    // URIから都市名とタイプを抽出
    const uri = request.params.uri.replace('weather://', '');
    const segments = uri.split('/');
    
    if (segments.length !== 2) {
      throw new Error('Invalid URI format: must contain exactly two segments (city and type)');
    }
    
    const [city, type] = segments;

    if (!city || !type) {
      throw new Error("Invalid URI format: city and type are required");
    }

    if (!["current", "forecast"].includes(type)) {
      throw new Error(`Invalid resource type: ${type}. Must be either 'current' or 'forecast'`);
    }

    if (type === "current") {
      const result = await getCurrentWeather(city);
      if ("error" in result) {
        throw new Error(`エラー: ${result.error}`);
      }
      return {
        _meta: {},
        contents: [
          {
            uri: request.params.uri,
            text: JSON.stringify({
              city: result.name,
              temperature: result.main.temp,
              description: result.weather[0]?.description || "情報なし",
              humidity: result.main.humidity,
              windSpeed: result.wind.speed,
              updatedAt: new Date(result.dt * 1000).toISOString()
            }, null, 2)
          },
        ],
      };
    }

    const result = await getForecast(city);
    if ("error" in result) {
      throw new Error(`エラー: ${result.error}`);
    }
    const formattedForecasts = result.list.map((item: WeatherListItem) => ({
      dateTime: item.dt_txt,
      temperature: item.main.temp,
      description: item.weather[0]?.description || "情報なし",
      precipitation_probability:
        item.pop !== undefined ? `${(item.pop * 100).toFixed(0)}%` : "N/A",
    }));
    return {
      _meta: {},
      contents: [
        {
          uri: request.params.uri,
          text: JSON.stringify({
            city: result.city.name,
            forecasts: formattedForecasts
          }, null, 2)
        },
      ],
    };
  } catch (error) {
    console.error("Error in ReadResourceRequestSchema handler:", error);
    throw error;
  }
});

// サーバー起動処理
const main = async () => {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // プロトコルメッセージと混ざらないように、サーバー起動メッセージは出力しない
  } catch (error: any) {
    console.error("MCP Server failed to connect:", error);
    process.exit(1);
  }
};

main();
