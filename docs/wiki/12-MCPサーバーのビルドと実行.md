# 12. MCPサーバーのビルドと実行

これまでの手順で `weather-server/src/index.ts` にMCPサーバーのロジックを実装しました。
このセクションでは、TypeScriptで書かれたソースコードをJavaScriptにコンパイル（ビルド）し、実際にローカル環境でMCPサーバーを実行して動作を確認する手順を説明します。

## 1. MCPサーバーのビルド

`@modelcontextprotocol/create-server` で作成されたプロジェクトの `package.json` には、通常、ビルド用のスクリプトが定義されています。

`weather-server` ディレクトリのターミナルで、以下のコマンドを実行してください。

```bash
npm run build
```
(yarn を使用している場合は `yarn build`)

このコマンドは、`tsconfig.json` の設定に基づいてTypeScriptコンパイラ (`tsc`) を実行し、`src` ディレクトリ内の `.ts` ファイルをコンパイルして、`build` ディレクトリ（または `tsconfig.json` で指定された出力ディレクトリ）に `.js` ファイルを生成します。
また、`create-server` のデフォルトのビルドスクリプトには、生成されたメインのJavaScriptファイル（例: `build/index.js`）に実行権限を付与する処理も含まれていることがあります。

ビルドが成功すると、`weather-server/build/index.js` というファイルが生成されているはずです。これが実行可能なMCPサーバーの本体となります。

## 2. ローカルでの実行確認 (準備)

MCPサーバーをローカルで実行するには、いくつかの準備が必要です。

*   **OpenWeatherMap APIキーの設定**:
    MCPサーバーは環境変数 `OPENWEATHER_API_KEY` からAPIキーを読み込むように実装しました。この環境変数を設定してサーバーを起動する必要があります。
*   **実行コマンド**:
    Node.jsで `build/index.js` を実行します。

環境変数を設定しつつコマンドを実行する方法はいくつかあります。

**方法A: コマンド実行時に直接指定する (Linux/macOS)**
```bash
OPENWEATHER_API_KEY="YOUR_API_KEY_HERE" node build/index.js
```

**方法B: コマンド実行時に直接指定する (Windows Command Prompt)**
```bash
set OPENWEATHER_API_KEY=YOUR_API_KEY_HERE
node build/index.js
```
(上記は2つのコマンドに分かれています。1行で実行する場合は `set OPENWEATHER_API_KEY=YOUR_API_KEY_HERE && node build/index.js` のようにします)

**方法C: Windows PowerShell**
```bash
$env:OPENWEATHER_API_KEY="YOUR_API_KEY_HERE"
node build/index.js
```

**方法D: `.env` ファイルを使用する (dotenv ライブラリなど)**
より本格的な開発では、`.env` ファイルに環境変数を記述し、`dotenv` のようなライブラリを使って読み込む方法も一般的ですが、このチュートリアルではMCPクライアント側からの環境変数設定を主眼に置くため、上記の方法で直接指定するか、後述するMCP設定ファイルでの指定を利用します。

## 3. MCPサーバーのローカル実行

上記の方法でAPIキーを設定し、`weather-server` ディレクトリで以下のコマンドを実行すると、MCPサーバーが起動します。

```bash
# 例 (Linux/macOS): YOUR_API_KEY_HERE を実際のAPIキーに置き換えてください
OPENWEATHER_API_KEY="YOUR_API_KEY_HERE" node build/index.js
```

サーバーが正常に起動すると、コンソールに以下のようなメッセージが表示されるはずです（実装によって多少異なります）。

```
Weather MCP Server is running. Available tools: get_current_weather, get_forecast
```

この状態になると、MCPサーバーはクライアントからのリクエストを待機しています。
Stdioベースのサーバーなので、標準入力からMCPプロトコルに準拠したメッセージを受け取り、標準出力に結果を返します。

**注意**: この段階では、まだMCPクライアント（RooのようなAIエージェント）と接続していません。サーバーが単独で起動し、リクエストを待っている状態です。実際にツールを呼び出して動作を確認するには、次のセクションで説明するMCP設定ファイルへの登録と、MCPクライアントからの呼び出しが必要になります。

サーバーを停止するには、ターミナルで `Ctrl+C` を押してください。

## 4. `package.json` の `start` スクリプト

`package.json` には `start` スクリプトが定義されている場合があります。
これが `node build/index.js` を実行するようになっていれば、以下のように起動することも可能です（APIキーの設定は別途必要です）。

```bash
OPENWEATHER_API_KEY="YOUR_API_KEY_HERE" npm start
```
(yarn の場合は `OPENWEATHER_API_KEY="YOUR_API_KEY_HERE" yarn start`)

---

これでMCPサーバーをビルドし、ローカルで実行する準備ができました。
次のセクションでは、このローカルサーバーをMCPクライアント（例: Roo）が認識できるように、MCP設定ファイルに登録する方法を説明します。