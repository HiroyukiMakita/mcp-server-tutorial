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
import { Server as McpServer } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { z } from 'zod';
```

## 2. ツール定義とハンドラーの作成

MCPサーバーでは、以下の重要なハンドラーを実装する必要があります：

1. `ListToolsRequestSchema`: 利用可能なツールの一覧を返す
2. `CallToolRequestSchema`: 実際のツール実行を処理する
3. `ListResourcesRequestSchema`: 利用可能なリソースの一覧を返す
4. `ListResourceTemplatesRequestSchema`: 利用可能なリソーステンプレートの一覧を返す

これらのハンドラーを使って、ツールとリソースの定義と実行ロジックを実装していきます。

### ツール一覧を返すハンドラー（ListToolsRequestSchema）の実装

[前半部分は同じなので省略...]

### リソース関連のハンドラーの実装

```typescript
// リソーステンプレートの定義
const weatherResourceTemplate = {
  uriTemplate: "weather://{city}/{type}",
  parameters: {
    city: z.string(),
    type: z.enum(["current", "forecast"])
  }
};

// リソース一覧を返すハンドラー
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        name: "weather",
        description: "都市の気象情報を提供するリソース",
        uriTemplate: weatherResourceTemplate.uriTemplate,
        uri: "weather://tokyo/current" // サンプルURIを提供
      },
    ],
  };
});

// リソーステンプレート一覧を返すハンドラー
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
```

*ポイント*:
- リソーステンプレートはURI形式で定義し、パラメータは波括弧 `{}` で囲みます
- リソース一覧ではサンプルURIを提供して、クライアントが使い方を理解しやすくします
- テンプレート一覧では各パラメータの詳細な説明とバリデーションルールを提供します

### リソース読み取りのハンドラーの実装

```typescript
// リソース読み取りのハンドラー
server.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest) => {
  const uri = new URL(request.params.uri);
  const [city, type] = uri.pathname.split('/').slice(1);

  if (!city || !type) {
    throw new Error("Invalid URI format: city and type are required");
  }

  if (!["current", "forecast"].includes(type)) {
    throw new Error(`Invalid resource type: ${type}. Must be either 'current' or 'forecast'`);
  }

  // 以降は各typeに応じた処理...
});
```

*ポイント*:
- URIのパスから必要なパラメータを抽出し、適切にバリデーション
- パラメータの有無と値の妥当性を確認
- エラーメッセージは具体的に、原因と期待される値を含める