# 11. MCPサーバーの実装 - メイン処理とユニットテスト

これまでのセクションで、型定義、APIクライアント、MCPツールの定義、そしてエラーハンドリングについて個別に見てきました。
このセクションでは、これらの部品を `weather-server/src/index.ts` ファイルに統合し、実際に動作するMCPサーバーとして完成させます。
さらに、コードの品質を保つために重要なユニットテストの簡単な導入例も紹介します。

## 1. `src/index.ts` の完成

これまでの解説で断片的に示してきたコードを `src/index.ts` にまとめます。
コードの見通しを良くするために、型定義 (`types.ts`) やAPIクライアント (`apiClient.ts`) を別ファイルに分割し、`index.ts` からインポートすることを強く推奨しますが、ここでは説明を簡潔にするため、主要な部分を `index.ts` に記述する形で示します。

```typescript
// weather-server/src/index.ts
import { Server as McpServer } from "@modelcontextprotocol/sdk/server/index.js"; // 変更点
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"; // 変更点
import { z } from 'zod';
import axios, { AxiosInstance } from 'axios';

// --- 型定義 (本来は types.ts などからインポート) ---
// (ここでは主要な型定義の構造のみ示します。詳細は前のページを参照してください)
const CurrentWeatherMainSchema = z.object({ temp: z.number(), humidity: z.number(), /* 他のプロパティ */ });
const WeatherConditionSchema = z.object({ description: z.string(), /* 他のプロパティ */ });
const WindSchema = z.object({ speed: z.number(), /* 他のプロパティ */ });
const CurrentWeatherResponseSchema = z.object({
  weather: z.array(WeatherConditionSchema).min(1),
  main: CurrentWeatherMainSchema,
  wind: WindSchema,
  dt: z.number(),
  name: z.string(),
});
type CurrentWeatherResponse = z.infer<typeof CurrentWeatherResponseSchema>;

const ForecastListItemSchema = z.object({ dt_txt: z.string(), main: CurrentWeatherMainSchema, weather: z.array(WeatherConditionSchema), pop: z.number().optional(), /* 他のプロパティ */ });
const ForecastResponseSchema = z.object({ list: z.array(ForecastListItemSchema), city: z.object({ name: z.string() }) });
type ForecastResponse = z.infer<typeof ForecastResponseSchema>;

const GetCurrentWeatherInputSchema = z.object({ city: z.string().min(1, "都市名は必須です。").describe("天気を取得したい都市名") });
type GetCurrentWeatherInput = z.infer<typeof GetCurrentWeatherInputSchema>;

const GetForecastInputSchema = z.object({
  city: z.string().min(1, "都市名は必須です。").describe("天気予報を取得したい都市名"),
  days: z.number().min(1).max(5).optional().default(3).describe("予報日数（1～5日、デフォルト3日）"),
});
type GetForecastInput = z.infer<typeof GetForecastInputSchema>;
// --- 型定義ここまで ---


// --- APIキーとAPIクライアント (本来は apiClient.ts などからインポート) ---
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const OPENWEATHER_API_BASE_URL = 'https://api.openweathermap.org/data/2.5';
let weatherApi: AxiosInstance;

if (!OPENWEATHER_API_KEY) {
  console.error('致命的エラー: 環境変数 OPENWEATHER_API_KEY が設定されていません。');
  process.exit(1);
}

weatherApi = axios.create({
  baseURL: OPENWEATHER_API_BASE_URL,
  params: { appid: OPENWEATHER_API_KEY, units: 'metric', lang: 'ja' },
  timeout: 10000,
});

async function getCurrentWeather(city: string): Promise<CurrentWeatherResponse | { error: string }> {
  console.log(`[API Client] 都市 "${city}" の現在の天気を取得します...`);
  try {
    const response = await weatherApi.get('/weather', { params: { q: city } });
    const parseResult = CurrentWeatherResponseSchema.safeParse(response.data);
    if (!parseResult.success) {
      console.error("[API Client] 現在の天気APIレスポンスのパースに失敗:", parseResult.error.flatten());
      return { error: `APIレスポンス(現在の天気)の形式が不正です: ${parseResult.error.message}` };
    }
    console.log(`[API Client] 都市 "${city}" の現在の天気取得成功。`);
    return parseResult.data;
  } catch (error) {
    const apiErrorMessage = axios.isAxiosError(error) ? (error.response?.data as any)?.message || error.message : '予期せぬエラー';
    console.error(`[API Client] 現在の天気取得エラー (都市: ${city}): ${apiErrorMessage}`, error);
    return { error: `天気取得APIエラー: ${apiErrorMessage}` };
  }
}

async function getForecast(city: string, days: number = 3): Promise<ForecastResponse | { error: string }> {
  console.log(`[API Client] 都市 "${city}" の ${days} 日間の天気予報を取得します...`);
  const cnt = Math.min(days, 5) * 8;
  try {
    const response = await weatherApi.get('/forecast', { params: { q: city, cnt } });
    const parseResult = ForecastResponseSchema.safeParse(response.data);
    if (!parseResult.success) {
      console.error("[API Client] 天気予報APIレスポンスのパースに失敗:", parseResult.error.flatten());
      return { error: `APIレスポンス(天気予報)の形式が不正です: ${parseResult.error.message}` };
    }
    console.log(`[API Client] 都市 "${city}" の ${days} 日間の天気予報取得成功。`);
    return parseResult.data;
  } catch (error) {
    const apiErrorMessage = axios.isAxiosError(error) ? (error.response?.data as any)?.message || error.message : '予期せぬエラー';
    console.error(`[API Client] 天気予報取得エラー (都市: ${city}): ${apiErrorMessage}`, error);
    return { error: `天気予報APIエラー: ${apiErrorMessage}` };
  }
}
// --- APIクライアントここまで ---


// --- MCPサーバーとツールの定義 ---

// get_current_weather ツールの定義オブジェクト
const getCurrentWeatherTool = {
  name: "get_current_weather",
  inputSchema: GetCurrentWeatherInputSchema,
  execute: async (input: GetCurrentWeatherInput) => {
    const { city } = input;
    console.log(`[Tool:get_current_weather] 都市 "${city}" の現在の天気を取得リクエスト受信。`);
    const weatherData = await getCurrentWeather(city);
    
    if ('error' in weatherData) {
      console.error(`[Tool:get_current_weather] エラー: ${weatherData.error}`);
      return { content: [{ type: "text", text: `エラー: ${weatherData.error}` }], isError: true };
    }
    
    const responseText = JSON.stringify({
      city: weatherData.name,
      temperature: weatherData.main.temp,
      description: weatherData.weather[0]?.description || "情報なし",
      humidity: weatherData.main.humidity,
      windSpeed: weatherData.wind.speed,
      updatedAt: new Date(weatherData.dt * 1000).toISOString(),
    }, null, 2);
    console.log(`[Tool:get_current_weather] 都市 "${city}" の現在の天気を返却します。`);
    return { content: [{ type: "text", text: responseText }] };
  },
};

// get_forecast ツールの定義オブジェクト
const getForecastTool = {
  name: "get_forecast",
  inputSchema: GetForecastInputSchema,
  execute: async (input: GetForecastInput) => {
    const { city, days } = input;
    console.log(`[Tool:get_forecast] 都市 "${city}" の ${days} 日間の天気予報を取得リクエスト受信。`);
    const forecastData = await getForecast(city, days);

    if ('error' in forecastData) {
      console.error(`[Tool:get_forecast] エラー: ${forecastData.error}`);
      return { content: [{ type: "text", text: `エラー: ${forecastData.error}` }], isError: true };
    }

    const formattedForecasts = forecastData.list.map(item => ({
      dateTime: item.dt_txt,
      temperature: item.main.temp,
      description: item.weather[0]?.description || "情報なし",
      precipitation_probability: item.pop !== undefined ? `${(item.pop * 100).toFixed(0)}%` : "N/A",
    }));
    const responseText = JSON.stringify({ city: forecastData.city.name, forecasts: formattedForecasts }, null, 2);
    console.log(`[Tool:get_forecast] 都市 "${city}" の ${days} 日間の天気予報を返却します。`);
    return { content: [{ type: "text", text: responseText }] };
  },
};

// MCPサーバーのインスタンスを作成し、ツールを登録
const server = new McpServer(
  { // 第一引数: サーバーの基本情報
    name: "weather-server-tutorial",
    version: "0.1.0",
    description: "天気情報を提供するMCPサーバー (チュートリアル用)",
  },
  { // 第二引数: サーバーのケイパビリティ (ツールなど)
    capabilities: {
      tools: { // toolsプロパティにツール定義オブジェクトを登録
        getCurrentWeatherTool,
        getForecastTool,
      },
    },
  }
);
// --- MCPサーバーとツールの定義ここまで ---


// --- サーバー起動処理 ---
async function main() {
  const transport = new StdioServerTransport();
  try {
    await server.connect(transport);
    console.log("Weather MCP Server is running. Available tools: get_current_weather, get_forecast");
  } catch (error) {
    console.error("MCP Server failed to connect:", error);
    process.exit(1);
  }
}

main();
// --- サーバー起動処理ここまで ---
```
*注意*: 上記コードは説明のための統合版です。実際のプロジェクトでは、型定義、APIクライアント、ユーティリティ関数などを適切にモジュール分割してください。各`z.object`内のスキーマ定義は `/* ... */` で省略していますので、前ページの内容を参考に補完してください。

## 2. ユニットテストの導入 (Vitest の例)

ユニットテストは、コードの個々の部品（関数やモジュール）が正しく動作することを検証するためのテストです。バグの早期発見やリファクタリング時の安心感につながります。
ここでは、設定が簡単で高速なテストフレームワークである [Vitest](https://vitest.dev/) を使った簡単な例を紹介します。

### a. Vitest のインストール

`weather-server` ディレクトリ内で、以下のコマンドを実行して Vitest を開発依存関係としてインストールします。

```bash
npm install --save-dev vitest
```
(yarn の場合は `yarn add --dev vitest`)

### b. `package.json` にテストスクリプトを追加

`weather-server/package.json` の `scripts` セクションに、テスト実行用のスクリプトを追加します。

```json
// weather-server/package.json
{
  // ... 他の設定 ...
  "scripts": {
    "build": "tsc", // tscコマンドでビルド (create-serverのデフォルトから変更する場合あり)
    "start": "node build/index.js", // ビルド後の実行 (create-serverのデフォルトから変更する場合あり)
    "dev": "tsc -w & node --watch build/index.js", // 開発用 (create-serverのデフォルトから変更する場合あり)
    "test": "vitest run", // Vitest を実行するスクリプト
    "test:watch": "vitest" // Vitest を監視モードで実行
  },
  // ... 他の設定 ...
}
```
*注意*: `build`, `start`, `dev` スクリプトは `@modelcontextprotocol/create-server` で生成されたものから変更されている可能性があります。ご自身のプロジェクトに合わせてください。

### c. 簡単なテストファイルの作成

例えば、APIクライアント関数 `getCurrentWeather` や `getForecast` の一部ロジックをテストすることを考えます。
テストファイルは、慣習的に `src` ディレクトリ内に `*.test.ts` (または `*.spec.ts`) という名前で作成します。

例として、`src/apiClient.test.ts` を作成し、API呼び出し部分をモック（偽の関数に置き換え）してテストするイメージです。
(このチュートリアルでは `apiClient.ts` を作成していないため、あくまで概念的な例として示します。)

```typescript
// weather-server/src/index.test.ts
import { describe, it, expect, vi } from 'vitest';
import axios from 'axios';

// axiosのモック設定
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn()
    })),
  },
}));

describe('API Client Functions', () => {
  const mockCity = "Tokyo";
  const mockAxiosCreate = axios.create as unknown as ReturnType<typeof vi.fn>;
  let mockAxiosGet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // 各テストの前にモックをリセット
    vi.clearAllMocks();
    mockAxiosGet = vi.fn();
    mockAxiosCreate.mockReturnValue({ get: mockAxiosGet });
  });

  describe('getCurrentWeather', () => {
    it('指定した都市の現在の天気を正しく取得し、整形されたデータを返すこと', async () => {
      const mockApiResponseData = {
        weather: [{ description: "晴れ", id: 800, main: "Clear", icon: "01d" }],
        main: { temp: 25, humidity: 60 },
        wind: { speed: 3, deg: 180 },
        dt: 1620000000,
        name: mockCity,
      };

      mockAxiosGet.mockResolvedValueOnce({ data: mockApiResponseData });

      const result = await getCurrentWeather(mockCity);

      expect(mockAxiosCreate).toHaveBeenCalled();
      expect(mockAxiosGet).toHaveBeenCalledWith('/weather', { params: { q: mockCity } });
      expect(result).toEqual(mockApiResponseData);
      expect(result).not.toHaveProperty('error');
    });

    it('API呼び出しでエラーが発生した場合、エラーオブジェクトを返すこと', async () => {
      mockAxiosGet.mockRejectedValueOnce({
        response: { data: { message: 'city not found' } }
      });

      const result = await getCurrentWeather('UnknownCity');

      expect(result).toHaveProperty('error');
      expect(result.error).toContain('city not found');
    });

    it('APIレスポンスのパースに失敗した場合、エラーオブジェクトを返すこと', async () => {
      mockAxiosGet.mockResolvedValueOnce({
        data: { invalid: 'response' }
      });

      const result = await getCurrentWeather('ParseErrorCity');

      expect(result).toHaveProperty('error');
      expect(result.error).toContain('APIレスポンス');
    });
  });

  describe('getForecast', () => {
    const mockDays = 1;

    it('指定した都市と日数の天気予報を正しく取得し、整形されたデータを返すこと', async () => {
      const mockApiResponseData = {
        cod: "200",
        message: 0,
        cnt: 8,
        list: [{
          dt: 1678886400,
          main: {
            temp: 20,
            feels_like: 22,
            temp_min: 18,
            temp_max: 23,
            pressure: 1013,
            humidity: 65
          },
          weather: [{
            id: 801,
            main: "Clouds",
            description: "薄い雲",
            icon: "02d"
          }],
          dt_txt: "2023-03-15 12:00:00",
          wind: { speed: 3, deg: 120 },
          pop: 0.1
        }],
        city: {
          id: 1853909,
          name: mockCity,
          country: "JP",
          coord: { lat: 34.6851, lon: 135.5044 }
        }
      };

      mockAxiosGet.mockResolvedValueOnce({ data: mockApiResponseData });

      const result = await getForecast(mockCity, mockDays);

      expect(mockAxiosCreate).toHaveBeenCalled();
      expect(mockAxiosGet).toHaveBeenCalledWith('/forecast', { params: { q: mockCity, cnt: mockDays * 8 } });
      expect(result).toEqual(mockApiResponseData);
      expect(result).not.toHaveProperty('error');
    });

    it('API呼び出しでエラーが発生した場合（予報）、エラーオブジェクトを返すこと', async () => {
      mockAxiosGet.mockRejectedValueOnce({
        response: { data: { message: 'city not found for forecast' } }
      });

      const result = await getForecast('ForecastUnknownCity', 3);

      expect(result).toHaveProperty('error');
      expect(result.error).toContain('city not found for forecast');
    });
  });
});
```
*コメント*: 上記は非常に簡略化されたテストの骨子です。実際のテストでは、`axios` のような外部依存を適切にモックし、様々な入力パターンやエッジケースを検証する必要があります。`vi.mock` や `vi.spyOn` などを活用します。

### d. テストの実行

ターミナルで `weather-server` ディレクトリに移動し、以下のコマンドでテストを実行します。

```bash
npm test
```
(yarn の場合は `yarn test`)

テストを実行すると、以下のような結果が表示されます：

```bash
 RUN  v3.2.3 /Users/mackey/Workspace/Projects/VibeCoding/roo-code-example/mcp-server-tutorial/weather-server

 ✓ src/index.test.ts (5 tests) 15ms
   ✓ API Client Functions > getCurrentWeather > 指定した都市の現在の天気を正しく取得し、整形されたデータを返すこと
   ✓ API Client Functions > getCurrentWeather > API呼び出しでエラーが発生した場合、エラーオブジェクトを返すこと
   ✓ API Client Functions > getCurrentWeather > APIレスポンスのパースに失敗した場合、エラーオブジェクトを返すこと
   ✓ API Client Functions > getForecast > 指定した都市と日数の天気予報を正しく取得し、整形されたデータを返すこと
   ✓ API Client Functions > getForecast > API呼び出しでエラーが発生した場合（予報）、エラーオブジェクトを返すこと

Test Files  1 passed (1)
     Tests  5 passed (5)
```

## 3. モジュール分割の実践

実際のプロジェクトでは、以下のような構造でファイルを分割することを推奨します：

```
weather-server/
├── src/
│   ├── types.ts           # 型定義
│   ├── apiClient.ts       # APIクライアントの実装
│   ├── index.ts           # MCPサーバーのメイン処理
│   └── index.test.ts      # ユニットテスト
```

- `types.ts`: zodスキーマと型定義を集約
- `apiClient.ts`: API呼び出しとデータ整形のロジックを分離
- `index.ts`: MCPツールの定義とサーバー設定に集中
- `index.test.ts`: ユニットテストをメインコードと分離

このような分割により：
1. コードの見通しが良くなる
2. 各機能の責任範囲が明確になる
3. テストがしやすくなる
4. 保守性が向上する

---

これで、MCPサーバーの主要な実装と、ユニットテストの導入に関する説明は完了です。
次のページでは、作成したMCPサーバーをビルドし、ローカルで実行して動作確認を行う方法と、MCP設定ファイルへの登録について説明します。