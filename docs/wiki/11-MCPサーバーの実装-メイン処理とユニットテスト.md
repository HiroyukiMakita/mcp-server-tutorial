# 11. MCPサーバーの実装 - メイン処理とユニットテスト

これまでのセクションで、型定義、APIクライアント、MCPツールの定義、そしてエラーハンドリングについて個別に見てきました。
このセクションでは、これらの部品を `weather-server/src/index.ts` ファイルに統合し、実際に動作するMCPサーバーとして完成させます。
さらに、コードの品質を保つために重要なユニットテストの簡単な導入例も紹介します。

## 1. `src/index.ts` の完成

これまでの解説で断片的に示してきたコードを `src/index.ts` にまとめます。
コードの見通しを良くするために、型定義 (`types.ts`) やAPIクライアント (`apiClient.ts`) を別ファイルに分割し、`index.ts` からインポートすることを強く推奨しますが、ここでは説明を簡潔にするため、主要な部分を `index.ts` に記述する形で示します。

```typescript
// weather-server/src/index.ts
import { McpServer, StdioServerTransport } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import axios, { AxiosInstance } from 'axios';

// --- 型定義 (本来は types.ts などからインポート) ---
const CurrentWeatherMainSchema = z.object({ /* ... */ temp: z.number(), humidity: z.number(), /* ... */ });
const WeatherConditionSchema = z.object({ /* ... */ description: z.string(), /* ... */ });
const WindSchema = z.object({ /* ... */ speed: z.number(), /* ... */ });
const CurrentWeatherResponseSchema = z.object({
  weather: z.array(WeatherConditionSchema).min(1),
  main: CurrentWeatherMainSchema,
  wind: WindSchema,
  dt: z.number(),
  name: z.string(),
});
type CurrentWeatherResponse = z.infer<typeof CurrentWeatherResponseSchema>;

const ForecastListItemSchema = z.object({ /* ... */ dt_txt: z.string(), main: CurrentWeatherMainSchema, weather: z.array(WeatherConditionSchema), /* ... */ });
const ForecastResponseSchema = z.object({ list: z.array(ForecastListItemSchema), city: z.object({ name: z.string() }) });
type ForecastResponse = z.infer<typeof ForecastResponseSchema>;

const GetCurrentWeatherInputSchema = z.object({ city: z.string().min(1) });
type GetCurrentWeatherInput = z.infer<typeof GetCurrentWeatherInputSchema>;

const GetForecastInputSchema = z.object({ city: z.string().min(1), days: z.number().min(1).max(5).optional().default(3) });
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
  try {
    const response = await weatherApi.get('/weather', { params: { q: city } });
    const parseResult = CurrentWeatherResponseSchema.safeParse(response.data);
    if (!parseResult.success) return { error: `APIレスポンス(現在の天気)の形式が不正です: ${parseResult.error.message}` };
    return parseResult.data;
  } catch (error) {
    if (axios.isAxiosError(error)) return { error: `天気取得APIエラー: ${(error.response?.data as any)?.message || error.message}` };
    return { error: '天気取得中に予期せぬエラーが発生しました。' };
  }
}

async function getForecast(city: string, days: number = 3): Promise<ForecastResponse | { error: string }> {
  const cnt = Math.min(days, 5) * 8;
  try {
    const response = await weatherApi.get('/forecast', { params: { q: city, cnt } });
    const parseResult = ForecastResponseSchema.safeParse(response.data);
    if (!parseResult.success) return { error: `APIレスポンス(天気予報)の形式が不正です: ${parseResult.error.message}` };
    return parseResult.data;
  } catch (error) {
    if (axios.isAxiosError(error)) return { error: `天気予報APIエラー: ${(error.response?.data as any)?.message || error.message}` };
    return { error: '天気予報取得中に予期せぬエラーが発生しました。' };
  }
}
// --- APIクライアントここまで ---


// --- MCPサーバーとツールの定義 ---
const server = new McpServer({
  name: "weather-server-tutorial",
  version: "0.1.0",
  description: "天気情報を提供するMCPサーバー (チュートリアル用)",
});

server.tool("get_current_weather", GetCurrentWeatherInputSchema, async (input) => {
  const { city } = input;
  console.log(`[Tool:get_current_weather] 都市 "${city}" の現在の天気を取得中...`);
  const weatherData = await getCurrentWeather(city);
  if ('error' in weatherData) return { content: [{ type: "text", text: `エラー: ${weatherData.error}` }], isError: true };
  
  const responseText = JSON.stringify({
    city: weatherData.name,
    temperature: weatherData.main.temp,
    description: weatherData.weather[0]?.description || "情報なし",
    humidity: weatherData.main.humidity,
    windSpeed: weatherData.wind.speed,
    updatedAt: new Date(weatherData.dt * 1000).toISOString(),
  }, null, 2);
  return { content: [{ type: "text", text: responseText }] };
});

server.tool("get_forecast", GetForecastInputSchema, async (input) => {
  const { city, days } = input;
  console.log(`[Tool:get_forecast] 都市 "${city}" の ${days} 日間の天気予報を取得中...`);
  const forecastData = await getForecast(city, days);
  if ('error' in forecastData) return { content: [{ type: "text", text: `エラー: ${forecastData.error}` }], isError: true };

  const formattedForecasts = forecastData.list.map(item => ({
    dateTime: item.dt_txt,
    temperature: item.main.temp,
    description: item.weather[0]?.description || "情報なし",
  }));
  const responseText = JSON.stringify({ city: forecastData.city.name, forecasts: formattedForecasts }, null, 2);
  return { content: [{ type: "text", text: responseText }] };
});
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
// weather-server/src/apiClient.test.ts (仮のファイル)
import { describe, it, expect, vi } from 'vitest';
// import { getCurrentWeather } from './apiClient'; // apiClient.ts からインポートすると仮定
// import axios from 'axios'; // axios もモック対象

// axios.get をモックする
// vi.mock('axios'); // Vitest v1.x 以降では vi.hoisted を使うか、トップレベルでのモック推奨

describe('Weather API Client', () => {
  it('getCurrentWeather should return weather data for a valid city', async () => {
    // モックされた axios.get が特定の値を返すように設定
    // (axios.get as vi.Mock).mockResolvedValue({ 
    //   data: { name: 'Tokyo', main: { temp: 25 }, weather: [{description: 'sunny'}], wind: {speed: 5}, dt: 1620000000 } 
    // });
    
    // const weather = await getCurrentWeather('Tokyo');
    // expect(weather).toHaveProperty('city', 'Tokyo');
    // expect(weather).toHaveProperty('temperature', 25);
    
    // このテストは、apiClient.ts が存在し、axios が適切にモックされている場合に動作します。
    // 今回のチュートリアルでは、テストの概念紹介に留めます。
    expect(true).toBe(true); // 仮の成功テスト
  });

  // 他のテストケース (エラー時など)
});
```
*コメント*: 上記は非常に簡略化されたテストの骨子です。実際のテストでは、`axios` のような外部依存を適切にモックし、様々な入力パターンやエッジケースを検証する必要があります。`vi.mock` や `vi.spyOn` などを活用します。

### d. テストの実行

ターミナルで `weather-server` ディレクトリに移動し、以下のコマンドでテストを実行します。

```bash
npm test
```
(yarn の場合は `yarn test`)

Vitest がテストファイルを探し出し、結果を表示します。

ユニットテストは奥が深い分野ですが、まずは簡単なテストから始めて、徐々にカバレッジを広げていくことが大切です。

---

これで、MCPサーバーの主要な実装と、ユニットテストの導入に関する説明は完了です。
次のページでは、作成したMCPサーバーをビルドし、ローカルで実行して動作確認を行う方法と、MCP設定ファイルへの登録について説明します。