# MCPサーバー構築チュートリアル

このチュートリアルでは、Model Context Protocol (MCP) サーバーを構築する方法を学びます。
Node.js と TypeScript を使用し、外部 API (OpenWeatherMap) と連携して天気情報を取得する MCP サーバーを作成します。

## 対象読者

*   Node.js および TypeScript の基本的な知識がある開発者
*   MCPサーバーの構築に初めて挑戦する方

## おおよその所要時間

*   2〜3時間程度

## 完成するMCPサーバーの機能

*   指定された都市の現在の天気情報と数日間の天気予報を OpenWeatherMap API から取得し、提供する MCP ツールを実装します。

## 必要な環境

*   **Node.js**: v18 以上を推奨
*   **npm** (Node.js に同梱) または **yarn**
*   **テキストエディタ**: VSCode を推奨
*   **Git**

## 環境構築手順

1.  **各種ツールのインストール**:
    *   **Node.js (npm を含む)**: [Node.js 公式サイト](https://nodejs.org/) からご自身の環境に合ったインストーラーをダウンロードし、インストールしてください。
    *   **yarn (任意)**: [Yarn 公式サイト](https://classic.yarnpkg.com/en/docs/install) の手順に従ってインストールしてください。npm を使用する場合は不要です。
    *   **Git**: [Git 公式サイト](https://git-scm.com/downloads) からダウンロードし、インストールしてください。
    *   **VSCode (推奨)**: [Visual Studio Code 公式サイト](https://code.visualstudio.com/) からダウンロードし、インストールしてください。
2.  **OpenWeatherMap API キーの取得**:
    *   このチュートリアルでは、天気情報を取得するために OpenWeatherMap API を使用します。
    *   [OpenWeatherMap のサインアップページ](https://home.openweathermap.org/users/sign_up) からアカウントを作成してください。
    *   ログイン後、[API keys タブ](https://home.openweathermap.org/api_keys) で API キーが生成されていることを確認します。通常、"Default" という名前のキーが自動で作成されています。このキーを後ほど使用します。

## チュートリアルの進め方

このチュートリアルは、本リポジトリの Wiki ページで詳細な手順を解説しています。
以下の順序で進めることをお勧めします。

*   [01. はじめに](https://github.com/HiroyukiMakita/mcp-server-tutorial/wiki/01-はじめに)
*   [02. MCPとは？](https://github.com/HiroyukiMakita/mcp-server-tutorial/wiki/02-MCPとは？)
*   [03. チュートリアルで作成するもの](https://github.com/HiroyukiMakita/mcp-server-tutorial/wiki/03-チュートリアルで作成するもの)
*   [04. 開発環境の準備](https://github.com/HiroyukiMakita/mcp-server-tutorial/wiki/04-開発環境の準備)
*   [05. MCPサーバープロジェクトの作成](https://github.com/HiroyukiMakita/mcp-server-tutorial/wiki/05-MCPサーバープロジェクトの作成)
*   [06. MCPサーバーの実装-APIキー設定と準備](https://github.com/HiroyukiMakita/mcp-server-tutorial/wiki/06-MCPサーバーの実装-APIキー設定と準備)
*   [07. MCPサーバーの実装-型定義](https://github.com/HiroyukiMakita/mcp-server-tutorial/wiki/07-MCPサーバーの実装-型定義)
*   [08. MCPサーバーの実装-APIクライアント](https://github.com/HiroyukiMakita/mcp-server-tutorial/wiki/08-MCPサーバーの実装-APIクライアント)
*   [09. MCPサーバーの実装-MCPツール定義](https://github.com/HiroyukiMakita/mcp-server-tutorial/wiki/09-MCPサーバーの実装-MCPツール定義)
*   [10. MCPサーバーの実装-エラーハンドリング](https://github.com/HiroyukiMakita/mcp-server-tutorial/wiki/10-MCPサーバーの実装-エラーハンドリング)
*   [11. MCPサーバーの実装-メイン処理とユニットテスト](https://github.com/HiroyukiMakita/mcp-server-tutorial/wiki/11-MCPサーバーの実装-メイン処理とユニットテスト)
*   [12. MCPサーバーのビルドと実行](https://github.com/HiroyukiMakita/mcp-server-tutorial/wiki/12-MCPサーバーのビルドと実行)
*   [13. MCP設定ファイルへの登録と動作確認](https://github.com/HiroyukiMakita/mcp-server-tutorial/wiki/13-MCP設定ファイルへの登録と動作確認)
*   [14. セキュリティに関する考慮事項](https://github.com/HiroyukiMakita/mcp-server-tutorial/wiki/14-セキュリティに関する考慮事項)
*   [15. 既存MCPサーバーとの連携](https://github.com/HiroyukiMakita/mcp-server-tutorial/wiki/15-既存MCPサーバーとの連携)
*   [16. 本番環境へのデプロイ考察](https://github.com/HiroyukiMakita/mcp-server-tutorial/wiki/16-本番環境へのデプロイ考察)
*   [17. トラブルシューティング](https://github.com/HiroyukiMakita/mcp-server-tutorial/wiki/17-トラブルシューティング)
*   [18. まとめと次のステップ](https://github.com/HiroyukiMakita/mcp-server-tutorial/wiki/18-まとめと次のステップ)

## コントリビューション

改善提案やバグ報告は、Issue や Pull Request でお気軽にお寄せください。

## ライセンス

このプロジェクトは MIT License のもとで公開されています。詳細は [`LICENSE`](LICENSE) ファイルをご覧ください。