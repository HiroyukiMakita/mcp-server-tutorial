# 06. MCPサーバーの実装 - APIキー設定と準備

いよいよMCPサーバーの心臓部である `src/index.ts` ファイルを編集し、天気情報を取得する機能を実装していきます。
このセクションでは、まず実装の全体像を把握し、最初のステップとしてOpenWeatherMap APIキーをMCPサーバーが利用できるように設定する方法と、`src/index.ts` の雛形コードの確認を行います。

## 実装の進め方

`weather-server` の実装は、以下のステップで進めていきます。

1.  **OpenWeatherMap APIキーの安全な読み込み**: MCPサーバーがAPIキーを環境変数経由で受け取れるようにします。
2.  **必要な型定義**: OpenWeatherMap APIのレスポンスデータや、自作するツールの入力・出力に関する型をTypeScriptで定義します（`zod`も活用）。
3.  **APIクライアントモジュールの作成**: `axios` を使用してOpenWeatherMap APIと通信するための関数群を作成します。
4.  **MCPツールの定義**:
    *   `get_current_weather`: 現在の天気を取得するツール。
    *   `get_forecast`: 数日間の天気予報を取得するツール。
    *   これらのツール内で、APIクライアントを呼び出し、取得したデータを整形して返します。入力値のバリデーションも行います。
5.  **エラーハンドリング**: API通信エラーや予期せぬエラーが発生した場合の処理を実装します。
6.  **メイン処理の記述**: `McpServer` インスタンスを作成し、定義したツールを登録し、サーバーを起動する処理を `src/index.ts` に記述します。
7.  **ユニットテストの作成**: 主要な関数やロジックに対して簡単なユニットテストを作成します。

## 1. OpenWeatherMap APIキーの設定準備

「[04. 開発環境の準備](04-開発環境の準備.md)」で取得したOpenWeatherMapのAPIキーを、MCPサーバーが利用できるように準備します。
APIキーのような機密情報は、ソースコードに直接書き込むのではなく、環境変数経由で渡すのが一般的です。

MCPサーバーの場合、実行時にMCPクライアント（Rooのようなエージェントをホストするシステム）から環境変数を渡すことができます。具体的には、後述する `mcp_settings.json` ファイルで設定します。

ここでは、`src/index.ts` の中で `process.env.OPENWEATHER_API_KEY` のような形でAPIキーを読み込むことを想定しておきます。

```typescript
// src/index.ts の冒頭部分のイメージ
const API_KEY = process.env.OPENWEATHER_API_KEY;

if (!API_KEY) {
  // APIキーが渡されていない場合はエラー処理を行う
  console.error('エラー: 環境変数 OPENWEATHER_API_KEY が設定されていません。');
  process.exit(1); // エラーで終了
}

// このAPI_KEYを使って後ほどAPIリクエストを行う
```
上記はあくまでイメージです。実際のエラーハンドリングはもう少し丁寧に行います。

## 2. `src/index.ts` の雛形確認

`npx @modelcontextprotocol/create-server weather-server` コマンドでプロジェクトを作成した際、`weather-server/src/index.ts` には既にMCPサーバーの雛形となるコードが生成されています。
まずはこの雛形コードを確認し、どこにどのような処理を追記していくのかを把握しましょう。

一般的な雛形には、以下のような要素が含まれていることが多いです。
*   必要なモジュールのインポート (`McpServer`, `StdioServerTransport` など)
*   `McpServer` インスタンスの作成
*   簡単なサンプルツールやリソースの定義 (コメントアウトされている場合もあります)
*   サーバーの起動処理

この雛形をベースに、不要なサンプルを削除・修正し、天気情報取得のためのコードを追加していきます。

次のページでは、具体的な型定義から始めていきます。