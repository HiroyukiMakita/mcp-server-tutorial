# 09. MCPサーバーの実装 - MCPツール定義

これまでに、APIレスポンスの型定義と、実際にOpenWeatherMap APIと通信するAPIクライアント関数を作成しました。
いよいよ、これらの部品を使ってMCPサーバーに具体的な「ツール」を定義していきます。

MCPツールは、MCPサーバーが外部に提供する機能の単位です。クライアント（RooのようなAIエージェント）は、このツール名を指定し、定義された入力パラメータを渡すことで、サーバーの機能を呼び出すことができます。

このセクションでは、以下の2つのツールを定義します。

*   `get_current_weather`: 指定した都市の現在の天気情報を取得する。
*   `get_forecast`: 指定した都市の数日間の天気予報を取得する。

## 1. `McpServer` インスタンスの準備

まず、`weather-server/src/index.ts` ファイルで `McpServer` クラスのインスタンスを作成します。
このインスタンスに対してツールを登録していきます。

```typescript
// weather-server/src/index.ts
import { Server as McpServer } from "@modelcontextprotocol/sdk/server/index.js"; // 変更点
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"; // 変更点
import { z } from 'zod';
import axios, { AxiosInstance } from 'axios'; // APIクライアントで使用

// --- ここから前ページまでに定義した型やAPIクライアント関数があると仮定 ---
// (例: GetCurrentWeatherInputSchema, getCurrentWeather, GetForecastInputSchema, getForecast など)
// 実際にはこれらを別ファイル (例: types.ts, apiClient.ts) に記述し、インポートすることを推奨します。

// (型の再掲 - 実際はインポートするか、index.tsの上部に定義)
const GetCurrentWeatherInputSchema = z.object({
  city: z.string().min(1, "都市名は必須です。").describe("天気を取得したい都市名"),
});
type GetCurrentWeatherInput = z.infer<typeof GetCurrentWeatherInputSchema>;

const GetForecastInputSchema = z.object({
  city: z.string().min(1, "都市名は必須です。").describe("天気予報を取得したい都市名"),
  days: z.number().min(1).max(5).optional().default(3).describe("予報日数（1～5日、デフォルト3日）"),
});
type GetForecastInput = z.infer<typeof GetForecastInputSchema>;

// (APIクライアント関数の再掲 - 実際はインポートするか、index.tsの上部に定義)
// async function getCurrentWeather(city: string): Promise<CurrentWeatherResponse | { error: string }> { ... }
// async function getForecast(city: string, days: number = 3): Promise<ForecastResponse | { error: string }> { ... }
// --- ここまで ---

// APIキーのチェック (サーバー起動前に行うのが望ましい)
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
if (!OPENWEATHER_API_KEY) {
  console.error('致命的エラー: 環境変数 OPENWEATHER_API_KEY が設定されていません。サーバーを起動できません。');
  process.exit(1); // APIキーがない場合はサーバーを起動せずに終了
}

// (axiosインスタンスやAPIクライアント関数はAPIキーチェック後に初期化・定義するのが安全)
// let weatherApi: AxiosInstance; // ... weatherApiの初期化 (前ページ参照)
// async function getCurrentWeather ...
// async function getForecast ...

// (ツール定義は後述。ここではサーバーインスタンス作成の準備のみ)
```
*コメント*: APIキーのチェックをサーバーインスタンス作成前に行い、キーが存在しない場合はエラー終了するようにしています。ツール定義は、`McpServer` のコンストラクタに渡す形で行います。

## 2. ツール定義とハンドラーの作成

MCPサーバーでは、2つの重要なハンドラーを実装する必要があります：

1. `ListToolsRequestSchema`: 利用可能なツールの一覧を返す
2. `CallToolRequestSchema`: 実際のツール実行を処理する

これらのハンドラーを使って、ツールの定義と実行ロジックを実装していきます。

### ツール一覧を返すハンドラー（ListToolsRequestSchema）の実装

MCPサーバーで最も重要なハンドラーの1つが、`ListToolsRequestSchema`です。このハンドラーは、クライアントがサーバーで利用可能なツールを探索するために使用します。

```typescript
// クライアントが利用可能なツールの一覧を取得するためのハンドラー
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
```

### ツール実行のハンドラーの実装

```typescript
// ツール実行を処理するハンドラー
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
```
*   `name`: ツール名 (文字列)。クライアントはこの名前でツールを呼び出します。
*   `inputSchema`: 入力パラメータの型を定義した `zod` スキーマ。MCP SDK はこのスキーマを使ってクライアントからの入力値を自動的にバリデーションします。
*   `execute`: ツールの本体となる非同期関数。引数にはバリデーション済みの入力オブジェクトが渡されます。
    *   この関数内で、APIクライアント関数 (`getCurrentWeather`) を呼び出し、結果を取得します。
    *   結果を `Content` オブジェクトの配列として返します。`type: "text"` でプレーンテキストやJSON文字列を返すのが一般的です。
    *   エラーが発生した場合は、`isError: true` を設定してエラーメッセージを返します。

*ポイント*:
- `ListToolsRequestSchema` ハンドラーでは、利用可能なツールの一覧とその入力スキーマを定義します。
- `CallToolRequestSchema` ハンドラーでは、実際のツール実行ロジックを実装します。
- レスポンスは必ず `content` 配列の形式で返す必要があります。
- エラーは例外をスローすることで表現します。
- こちらも `get_current_weather` と同様の構造です。入力スキーマ (`GetForecastInputSchema`) とAPIクライアント関数 (`getForecast`) が異なります。

### `ListToolsRequestSchema`の仕組みと使い方

1. **ハンドラーの役割**:
   - サーバーで利用可能なすべてのツールの一覧を提供します
   - 各ツールの名前、説明、入力パラメータの情報を返します
   - クライアントはこの情報を使ってツールを適切に呼び出せます

2. **レスポンスの構造**:
   ```typescript
   {
     tools: [
       {
         name: string;         // ツールの識別子
         description: string;  // ツールの説明
         inputSchema: {        // JSON Schema形式の入力パラメータ定義
           type: "object";
           properties: {
             [key: string]: {
               type: string;
               description?: string;
               [key: string]: any;  // その他のJSON Schemaプロパティ
             }
           };
           required?: string[];
         }
       },
       // ... 他のツール ...
     ]
   }
   ```

3. **クライアント側での使用方法**:
   ```typescript
   // クライアントコードの例
   const tools = await client.listTools();
   // 利用可能なツールの一覧を取得
   console.log(tools);
   
   // 特定のツールを使用
   const result = await client.callTool({
     name: "get_current_weather",
     arguments: { city: "Tokyo" }
   });
   ```

4. **セキュリティと制御**:
   - ツール一覧は動的に変更可能です
   - 権限に応じて表示するツールを制御できます
   - クライアントの状態に応じてツールの利用可否を管理できます

## 3. MCPサーバーインスタンスの作成

MCPサーバーインスタンスを作成し、基本的なケイパビリティを設定します。

```typescript
// MCPサーバーのインスタンスを作成
const server = new McpServer(
  { // 第一引数: サーバーの基本情報
    name: "weather-server-tutorial",
    version: "0.1.0",
    description: "天気情報を提供するMCPサーバー (チュートリアル用)",
  },
  { // 第二引数: サーバーのケイパビリティ
    capabilities: {
      tools: {}, // ツールはハンドラーで定義するため、空オブジェクトを指定
    },
  }
);
```
*コメント*: `McpServer` のコンストラクタの第一引数にはサーバーの基本情報（名前、バージョン、説明）を渡します。第二引数にはオプションでケイパビリティを指定するオブジェクトを渡せます。このオブジェクトの `capabilities.tools` プロパティに、先ほど定義したツールオブジェクト (`getCurrentWeatherTool`, `getForecastTool`) をキーと値のペアとして設定することで、サーバーにツールが登録されます。

## 4. サーバーの起動処理

すべてのツールを定義・登録したら、最後にサーバーを起動するための処理を記述します。
Stdioベースのサーバーの場合、`StdioServerTransport` を使用します。この部分は以前の方式と大きな変更はありません。

```typescript
// --- ここまでにサーバーインスタンスの作成とツール登録が完了している ---

async function main() {
  // Stdio (標準入出力) を使用したトランスポートを作成
  const transport = new StdioServerTransport();

  // MCPサーバーをトランスポートに接続し、メッセージの送受信を開始
  try {
    await server.connect(transport);
    console.log("Weather MCP Server is running and connected via Stdio.");
    console.log("利用可能なツール: get_current_weather, get_forecast");
  } catch (error) {
    console.error("MCP Server failed to connect:", error);
    process.exit(1);
  }
}

// メイン関数を実行
main();
```
これで、`src/index.ts` の主要な実装は完了です。

## 5. ファイル構成と実際の分割例

実際の実装では、以下のような構造でファイルを分割しています：

```
weather-server/
├── src/
│   ├── apiClient.ts    # APIクライアントの実装
│   │                   # - OpenWeatherMap APIとの通信
│   │                   # - レスポンスの型チェック
│   │                   # - エラーハンドリング
│   │
│   ├── index.ts        # メインのMCPサーバー実装
│   │                   # - ツール定義
│   │                   # - サーバー設定
│   │                   # - 起動処理
│   │
│   └── index.test.ts   # ユニットテスト
                        # - APIクライアントのテスト
                        # - モック設定
```

この分割により：
1. 各ファイルの責務が明確
2. コードの保守性が向上
3. テストがしやすい構造
4. 将来の機能追加や変更が容易

次のページでは、作成したMCPサーバーをビルドし、ローカルで実行して動作確認を行う方法と、MCP設定ファイルへの登録について説明します。