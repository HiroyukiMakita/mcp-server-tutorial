# 13. MCP設定ファイルへの登録と動作確認

前のセクションで、作成した `weather-server` をビルドし、ローカルで単独実行する準備ができました。
しかし、このままではMCPクライアント（RooのようなAIエージェント）は、このサーバーの存在や提供するツールを知ることができません。
このセクションでは、作成したMCPサーバーをクライアントに認識させ、実際にツールを呼び出して動作を確認するために、MCP設定ファイルにサーバー情報を登録する方法を説明します。

## 1. MCP設定ファイル (`mcp_settings.json`) について

MCPクライアントは、特定の場所にある設定ファイル（通常は `mcp_settings.json`）を読み込み、そこに記述されたMCPサーバーの情報を基に各サーバーへ接続を試みます。
このファイルに、私たちが作成した `weather-server` の起動方法や必要な環境変数を記述します。

### 設定ファイルの場所

`mcp_settings.json` の具体的な場所は、使用しているMCPクライアントアプリケーションによって異なります。
Roo (VSCode拡張機能版) の場合、一般的には以下のパスにあります。

*   **macOS**: `~/Library/Application Support/Cursor/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json`
    *   (Cursor は VSCode のフォークなので、VSCode 本体であればパスが若干異なる可能性があります。例: `~/Library/Application Support/Code/User/globalStorage/...`)
*   **Windows**: `%APPDATA%\Code\User\globalStorage\rooveterinaryinc.roo-cline\settings\mcp_settings.json` (おおよそのパス)
*   **Linux**: `~/.config/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json` (おおよそのパス)

*注意*: 上記は一般的なパスであり、環境やクライアントのバージョンによって異なる場合があります。正確な場所はクライアントのドキュメント等で確認してください。もしファイルが存在しない場合は、指定されたディレクトリに新規作成してください。

## 2. `weather-server` の設定情報を追記

`mcp_settings.json` ファイルを開き（なければ新規作成し）、以下のようなJSON形式で `weather-server` の設定を追記します。
ファイルが既に存在し、他のサーバー設定が含まれている場合は、`mcpServers` オブジェクト内に新しいエントリとして追加します。

```json
{
  "mcpServers": {
    // 他のMCPサーバーの設定がここにあるかもしれない
    // ...

    "weather-tutorial-server": { // 任意のサーバー識別名
      "command": "node", // 実行するコマンド
      "args": [
        // weather-server/build/index.js への絶対パスを指定
        // 例: "/Users/yourusername/path/to/mcp-server-tutorial/weather-server/build/index.js"
        // 例: "C:/Users/yourusername/path/to/mcp-server-tutorial/weather-server/build/index.js"
        "ここに/weather-server/build/index.jsへの絶対パスを記述してください"
      ],
      "env": {
        // サーバーが必要とする環境変数
        "OPENWEATHER_API_KEY": "YOUR_OPENWEATHERMAP_API_KEY_HERE" // 取得したAPIキーに置き換える
      },
      "disabled": false, // false にするとサーバーが有効になる
      "alwaysAllow": []  // ユーザー確認なしに実行を許可するツール名のリスト (通常は空でOK)
    }

    // 他のMCPサーバーの設定がここにあるかもしれない
    // ...
  }
}
```

**設定のポイント**:

*   **`"weather-tutorial-server"`**: これはMCPクライアントがこのサーバーを識別するための名前です。任意ですが、分かりやすい名前をつけましょう。
*   **`"command"`**: サーバーを起動するコマンドです。Node.jsで実行するので `"node"` を指定します。
*   **`"args"`**: `command` に渡す引数の配列です。ビルドされた `index.js` ファイルへの**絶対パス**を指定します。
    *   **重要**: 必ずご自身の環境における `weather-server/build/index.js` への正しい絶対パスに置き換えてください。相対パスでは正しく動作しない場合があります。
*   **`"env"`**: サーバープロセスに渡す環境変数をキーと値のペアで指定します。ここで `OPENWEATHER_API_KEY` に、ご自身が取得したOpenWeatherMapのAPIキーを設定します。
*   **`"disabled": false`**: `false` に設定することで、MCPクライアントはこのサーバーを起動・利用しようとします。`true` にすると無効化されます。
*   **`"alwaysAllow": []`**: 特定のツールをユーザーの確認なしに実行許可する場合にツール名を指定しますが、通常はセキュリティのため空配列 `[]` のままにしておきます。

## 3. MCPクライアントの再起動とサーバーの自動起動

`mcp_settings.json` を保存した後、MCPクライアント（例: Rooが動作しているVSCodeウィンドウ）を再起動（またはリロード）してください。
クライアントは起動時に `mcp_settings.json` を読み込み、`"disabled": false` になっているサーバーを自動的に起動しようとします。

`weather-server` が正しく起動すると、サーバー側のコンソール（もしあれば）に「Weather MCP Server is running...」のようなメッセージが表示されます。
また、MCPクライアント側でも、この新しいサーバーとそのツール（`get_current_weather`, `get_forecast`）が利用可能になったことが認識されるはずです（通常、システムプロンプトや利用可能なツール一覧に変化が現れます）。

## 4. 動作確認 (ツール呼び出し)

MCPクライアント（例: Roo）に対して、登録したツールを呼び出すような指示を出してみましょう。

**例1: 現在の天気を取得**
「東京の現在の天気を教えて」
「`get_current_weather` ツールを使って、都市名を `London` として実行して」

**例2: 天気予報を取得**
「大阪の3日間の天気予報は？」
「`get_forecast` ツールで、都市 `New York`、日数 `5` で実行して」

クライアントが正しくツールを呼び出し、`weather-server` がOpenWeatherMap APIから情報を取得して結果を返せば、天気情報が表示されるはずです。

**エラーが発生した場合**:

*   **サーバー側のコンソールログ**: `weather-server` を起動したターミナルにエラーメッセージが出力されていないか確認します。APIキーの間違い、APIリクエストの失敗、コード内のバグなどが考えられます。
*   **MCPクライアント側のログ**: クライアントがサーバーとの通信でエラーを検知した場合、クライアント側のログやUIに情報が表示されることがあります。
*   **`mcp_settings.json` の記述ミス**: パスやAPIキーの記述が正しいか再確認してください。

---

これで、作成したMCPサーバーを実際に利用する準備が整いました。
次のセクションでは、セキュリティに関する考慮事項や、本番環境へのデプロイに関する考察など、より発展的なトピックについて触れていきます。