# 10. MCPサーバーの実装 - エラーハンドリング

堅牢なアプリケーションを作成する上で、エラーハンドリングは非常に重要な要素です。MCPサーバーも例外ではありません。
外部APIとの通信、予期しない入力、内部ロジックの不具合など、様々な原因でエラーが発生する可能性があります。
このセクションでは、作成中の天気情報MCPサーバーにおいて、どのようにエラーを処理し、クライアント（AIエージェントなど）に適切に伝えるかについて説明します。

## エラーハンドリングの基本方針

1.  **エラーの捕捉**: `try...catch` ブロックを使用して、エラーが発生しうる箇所（特にAPIリクエストや外部ライブラリの呼び出し）でエラーを捕捉します。
2.  **エラー情報の特定**: 発生したエラーがどのような種類のものか（例: `axios` のAPI通信エラー、`zod` のバリデーションエラー、その他の予期せぬエラー）を特定します。
3.  **ログ出力**: サーバー側のデバッグや問題追跡のために、エラーの詳細情報をコンソールなどに出力します。
4.  **クライアントへの通知**: MCPクライアントに対して、エラーが発生したことと、可能であればエラーの原因を示すメッセージを返します。MCPツールでは、戻り値の `Content` オブジェクトに `isError: true` フラグを立ててエラーであることを示します。

## 1. APIクライアントにおけるエラーハンドリング

「[08-MCPサーバーの実装-APIクライアント](08-MCPサーバーの実装-APIクライアント.md)」で作成した `getCurrentWeather` 関数や `getForecast` 関数では、既に基本的なエラーハンドリングが実装されています。

```typescript
// (getCurrentWeather 関数のエラー処理部分の再掲)
// ...
  } catch (error) {
    if (axios.isAxiosError(error)) {
      // axios によるネットワークエラーやAPIからのエラーレスポンス
      console.error(`現在の天気取得APIエラー (都市: ${city}):`, error.response?.data || error.message);
      const errorMessage = (error.response?.data as any)?.message || error.message; // APIからのエラーメッセージを取得試行
      return { error: `天気の取得に失敗しました: ${errorMessage}` }; // エラー情報をオブジェクトで返す
    }
    // axios以外の予期せぬエラー
    console.error(`予期せぬエラー (現在の天気取得 - 都市: ${city}):`, error);
    return { error: '天気の取得中に予期せぬエラーが発生しました。' };
  }
// ...
```

**ポイント**:

*   `axios.isAxiosError(error)`: `axios` に起因するエラーかどうかを判別します。これにより、ネットワークの問題やAPIサーバーからのエラーレスポンス（4xx, 5xx系）を他のエラーと区別できます。
*   `error.response?.data`: APIサーバーがエラーレスポンスボディに詳細なエラー情報を含めている場合、これを参照します。OpenWeatherMap APIの場合、`message` プロパティにエラー内容が含まれていることがあります。
*   `console.error`: サーバーログにエラーの詳細を出力します。
*   関数の戻り値: 正常なレスポンスの型 (`CurrentWeatherResponse` など) とは異なる、エラー情報を含むオブジェクト (`{ error: string }`) を返すことで、呼び出し元がエラーを判別できるようにしています。

## 2. MCPツール定義におけるエラーハンドリング

「[09-MCPサーバーの実装-MCPツール定義](09-MCPサーバーの実装-MCPツール定義.md)」で定義したMCPツール内でも、APIクライアント関数からのエラーを適切に処理し、MCPクライアントに伝えます。

```typescript
// (get_current_weather ツールのエラー処理部分の再掲)
// ...
    const weatherData = await getCurrentWeather(city);

    if ('error' in weatherData) { // APIクライアント関数がエラーオブジェクトを返した場合
      return {
        content: [{ type: "text", text: `エラー: ${weatherData.error}` }],
        isError: true, // MCPクライアントにエラーであることを伝える
      };
    }
// ...
```

**ポイント**:

*   APIクライアント関数がエラーオブジェクト (`{ error: string }`) を返したかどうかをチェックします。
*   エラーの場合、MCPツールの戻り値として `content` にエラーメッセージを含め、`isError: true` を設定します。これにより、MCPクライアントはツール実行が失敗したことを認識できます。

## 3. `zod` によるバリデーションエラーの処理

`zod` を使用してAPIレスポンスやツールの入力値をパース・バリデーションする際にもエラーが発生する可能性があります。`safeParse` を使用すると、パース結果オブジェクトからエラー情報を取得できます。

```typescript
// (APIクライアント関数内でのzodパース処理の再掲)
// ...
    const parseResult = CurrentWeatherResponseSchema.safeParse(response.data);
    if (!parseResult.success) {
      // パース失敗
      console.error("現在の天気APIレスポンスのパースに失敗:", parseResult.error.flatten());
      // parseResult.error.issues に詳細なエラー情報が含まれる
      // parseResult.error.message で包括的なエラーメッセージを取得可能
      return { error: `APIレスポンスの形式が不正です: ${parseResult.error.message}` };
    }
    // パース成功
    return parseResult.data;
// ...
```

**ポイント**:

*   `parseResult.success`: パースとバリデーションが成功したかどうかを示します。
*   `parseResult.error`: パース失敗時に `ZodError` オブジェクトが含まれます。
    *   `parseResult.error.flatten()`: エラー情報をフィールドごとに分かりやすく整形します。
    *   `parseResult.error.issues`: 個々のバリデーションエラーの詳細なリスト。
    *   `parseResult.error.message`: `zod` が生成する包括的なエラーメッセージ文字列。
*   これらの情報をログに出力したり、クライアントに返すエラーメッセージに含めたりすることで、問題の原因究明に役立ちます。

## 4. APIキー未設定時のエラー処理

環境変数 `OPENWEATHER_API_KEY` が設定されていない場合、API呼び出しは必ず失敗します。
「[09-MCPサーバーの実装-MCPツール定義](09-MCPサーバーの実装-MCPツール定義.md)」の冒頭で、APIキーが存在しない場合はサーバーを起動せずにエラー終了する処理を追加しました。

```typescript
// (APIキーチェック部分の再掲)
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
if (!OPENWEATHER_API_KEY) {
  console.error('致命的エラー: 環境変数 OPENWEATHER_API_KEY が設定されていません。サーバーを起動できません。');
  process.exit(1); // プロセスを終了
}
```
これは、サーバー起動時の前提条件が満たされていない場合に、早期に問題を検出し、無駄な処理を防ぐための重要なエラーハンドリングです。

## まとめ

エラーハンドリングは、アプリケーションの信頼性と使いやすさを向上させるために不可欠です。
以下の点を意識して実装しましょう。

*   エラーが発生しうる箇所を特定し、適切に捕捉する。
*   エラーの原因を特定し、ログに詳細な情報を残す。
*   ユーザー（この場合はMCPクライアント）に分かりやすいエラーメッセージを返す。
*   可能な場合は、エラーからの回復処理や代替処理を検討する（今回のチュートリアルではそこまで踏み込みません）。

次のページでは、これまでに作成した各部品を組み合わせて `src/index.ts` を完成させ、ユニットテストの導入について説明します。