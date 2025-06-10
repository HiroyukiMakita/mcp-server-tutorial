# MCPサーバープロジェクトの作成

開発環境の準備が整ったら、いよいよMCPサーバーのプロジェクトを作成します。
このチュートリアルでは、`@modelcontextprotocol/create-server` というユーティリティを使用して、TypeScriptベースのMCPサーバープロジェクトの雛形を簡単に作成します。

## 1. プロジェクトの初期化

ターミナルを開き、このチュートリアル用にクローンした `mcp-server-tutorial` ディレクトリに移動してください。
そして、以下のコマンドを実行します。

```bash
cd path/to/your/mcp-server-tutorial 
npx @modelcontextprotocol/create-server weather-server
```

*   `npx` は、ローカルにインストールされていないnpmパッケージを実行するためのコマンドです。
*   `@modelcontextprotocol/create-server` がプロジェクト作成ツールです。
*   `weather-server` は、作成するプロジェクト（MCPサーバー）の名前です。この名前でサブディレクトリが作成されます。

コマンドを実行すると、`mcp-server-tutorial` ディレクトリ内に `weather-server` という名前の新しいディレクトリが作成され、その中にMCPサーバープロジェクトの基本的なファイル群が生成されます。

## 2. 作成されたプロジェクトへの移動と依存関係のインストール

プロジェクトが作成されたら、そのディレクトリに移動し、必要な初期依存関係をインストールします。

```bash
cd weather-server
npm install
```
(yarn を使用している場合は `yarn install` を実行してください)

`npm install` を実行すると、プロジェクトの `package.json` ファイルに定義されている依存ライブラリ（MCP SDKなど）が `node_modules` ディレクトリにインストールされます。

## 3. 追加ライブラリのインストール

このチュートリアルで作成する天気情報サーバーでは、外部APIとの通信のために `axios`、データのバリデーションと型定義のために `zod` というライブラリを使用します。
これらをプロジェクトに追加インストールしましょう。

`weather-server` ディレクトリ内で、以下のコマンドを実行します。

```bash
npm install axios zod
```
(yarn を使用している場合は `yarn add axios zod` を実行してください)

これで、開発に必要なライブラリが揃いました。

## 4. ディレクトリ構成の確認

`weather-server` ディレクトリの中は、おおよそ以下のようになっているはずです（一部のファイルはバージョンによって異なる場合があります）。

```
weather-server/
├── node_modules/      # インストールされたライブラリ
├── src/               # ソースコードディレクトリ
│   └── index.ts       # MCPサーバーのエントリーポイントとなるメインファイル (雛形)
├── .gitignore         # Gitで無視するファイルの設定
├── package.json       # プロジェクト情報、依存ライブラリ、スクリプトなどを定義
├── tsconfig.json      # TypeScriptコンパイラの設定
└── (その他設定ファイルなど)
```

*   **`src/index.ts`**: ここにMCPサーバーの主要なロジックを記述していきます。初期状態では、簡単なサンプルコードが含まれています。
*   **`package.json`**:
    *   `dependencies`: プロジェクトが依存するライブラリ（`@modelcontextprotocol/sdk`, `axios`, `zod` など）がリストされています。
    *   `scripts`: プロジェクトのビルドや実行のためのコマンドが定義されています。例えば、`npm run build` でTypeScriptのコードをJavaScriptにコンパイルし、`npm start` (または `npm run dev`) で開発サーバーを起動するようなスクリプトが含まれていることが多いです。
*   **`tsconfig.json`**: TypeScriptのコンパイルオプションが設定されています。

これでMCPサーバープロジェクトの骨組みが完成しました。
次のセクションでは、この `src/index.ts` を編集して、天気情報を取得するMCPサーバーの機能を実装していきます。