# 11. MCPサーバーの実装 - メイン処理とユニットテスト

これまでのセクションで、型定義、APIクライアント、MCPツールの定義、そしてエラーハンドリングについて個別に見てきました。
このセクションでは、これらの部品を `weather-server/src/index.ts` ファイルに統合し、実際に動作するMCPサーバーとして完成させます。
さらに、コードの品質を保つために重要なユニットテストの簡単な導入例も紹介します。

## 1. `src/index.ts` の実装

主要なコンポーネントは以下の通りです：

1. APIクライアント (`getCurrentWeather`, `getForecast`)
2. MCPツール定義とハンドラー
3. リソースハンドラー
4. サーバー起動処理

特に重要なのは、リソースハンドラーの実装です。URIの形式は`weather://{city}/{type}`で、以下のような処理が必要です：

```typescript
// リソース読み取りのハンドラーを登録
server.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest) => {
  try {
    // URIのバリデーション
    if (!request.params.uri.startsWith('weather://')) {
      throw new Error('Invalid URI scheme: must start with weather://');
    }

    // URIから都市名とタイプを抽出
    const uri = request.params.uri.replace('weather://', '');
    const segments = uri.split('/');
    
    if (segments.length !== 2) {
      throw new Error('Invalid URI format: must contain exactly two segments (city and type)');
    }
    
    const [city, type] = segments;

    if (!city || !type) {
      throw new Error("Invalid URI format: city and type are required");
    }

    if (!["current", "forecast"].includes(type)) {
      throw new Error(`Invalid resource type: ${type}. Must be either 'current' or 'forecast'`);
    }

    // 天気情報の取得と返却
    if (type === "current") {
      const result = await getCurrentWeather(city);
      if ("error" in result) {
        throw new Error(`エラー: ${result.error}`);
      }
      return {
        _meta: {},
        contents: [
          {
            uri: request.params.uri,
            text: JSON.stringify({
              city: result.name,
              temperature: result.main.temp,
              description: result.weather[0]?.description || "情報なし",
              humidity: result.main.humidity,
              windSpeed: result.wind.speed,
              updatedAt: new Date(result.dt * 1000).toISOString()
            }, null, 2)
          },
        ],
      };
    }

    // 天気予報の取得と返却
    const result = await getForecast(city);
    if ("error" in result) {
      throw new Error(`エラー: ${result.error}`);
    }
    const formattedForecasts = result.list.map((item) => ({
      dateTime: item.dt_txt,
      temperature: item.main.temp,
      description: item.weather[0]?.description || "情報なし",
      precipitation_probability:
        item.pop !== undefined ? `${(item.pop * 100).toFixed(0)}%` : "N/A",
    }));
    return {
      _meta: {},
      contents: [
        {
          uri: request.params.uri,
          text: JSON.stringify({
            city: result.city.name,
            forecasts: formattedForecasts
          }, null, 2)
        },
      ],
    };
  } catch (error) {
    console.error("Error in ReadResourceRequestSchema handler:", error);
    throw error;
  }
});
```

### URI形式の説明

リソースURIは以下の形式に従います：
- スキーム: `weather://`
- 都市名: 任意の都市名（例：`tokyo`）
- タイプ: `current`または`forecast`

例：
- `weather://tokyo/current` - 東京の現在の天気
- `weather://osaka/forecast` - 大阪の天気予報

注意点：
- URIのパースには単純な文字列操作を使用し、URLオブジェクトは使用しません
- スキーム(`weather://`)の後には都市名とタイプが必要です
- タイプは`current`または`forecast`のみ有効です

## 2. ユニットテストの導入 (Vitest の例)

[... 以下のユニットテストの内容は変更なし ...]