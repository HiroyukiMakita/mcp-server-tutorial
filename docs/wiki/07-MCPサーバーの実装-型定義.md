# 07. MCPサーバーの実装 - 型定義

MCPサーバーの実装を進めるにあたり、まず最初に行う重要なステップの一つが「型定義」です。
TypeScript を使用する大きなメリットの一つは静的型付けによる恩恵を受けられることであり、これによりコードの可読性、保守性、そして実行時のエラーを未然に防ぐ堅牢性が向上します。

このセクションでは、以下の型を定義していきます。

*   OpenWeatherMap API から返却されるデータ（現在の天気、予報）の型。
*   作成するMCPツール（`get_current_weather`, `get_forecast`）の入力パラメータの型。
*   MCPツールが出力する結果の型（今回は主にJSON文字列ですが、その元となるオブジェクトの型）。

型定義には、TypeScript のインターフェースや型エイリアスに加え、スキーマ定義・バリデーションライブラリである `zod` を活用します。`zod` を使うことで、実行時にもデータの構造を検証でき、より安全なコードを書くことができます。

## 1. `zod` のインポート

まず、`weather-server/src/index.ts` ファイルの冒頭（または型定義をまとめる別のファイルを作成する場合はそのファイル）で `zod` をインポートします。

```typescript
// weather-server/src/index.ts (または types.ts など)
import { z } from "zod";
```

## 2. OpenWeatherMap API レスポンスの型定義

OpenWeatherMap API のドキュメントを参考に、必要なデータ構造を `zod` スキーマとして定義します。
APIドキュメント:
*   Current weather data: [https://openweathermap.org/current](https://openweathermap.org/current)
*   5 day / 3 hour forecast: [https://openweathermap.org/forecast5](https://openweathermap.org/forecast5)

以下は、APIレスポンスの一部を抜粋した型定義の例です。実際のAPIレスポンスはより多くのフィールドを含んでいますが、ここではチュートリアルで使用する主要なものに絞っています。

### 現在の天気 (Current Weather)

```typescript
// 現在の天気の主要部分のスキーマ
const CurrentWeatherMainSchema = z.object({
  temp: z.number().describe("気温（摂氏）"),
  feels_like: z.number().describe("体感気温（摂氏）"),
  temp_min: z.number().describe("最低気温（摂氏）"),
  temp_max: z.number().describe("最高気温（摂氏）"),
  pressure: z.number().describe("気圧 (hPa)"),
  humidity: z.number().describe("湿度 (%)"),
});

// 天気概況のスキーマ
const WeatherConditionSchema = z.object({
  id: z.number().describe("天気ID"),
  main: z.string().describe("天気パラメータ（Rain, Snow, Extremeなど）"),
  description: z.string().describe("天気概況（詳細）"),
  icon: z.string().describe("天気アイコンID"),
});

// 風のスキーマ
const WindSchema = z.object({
  speed: z.number().describe("風速 (meter/sec)"),
  deg: z.number().describe("風向 (degrees)"),
});

// 現在の天気APIレスポンス全体のスキーマ (主要部分)
const CurrentWeatherResponseSchema = z.object({
  weather: z.array(WeatherConditionSchema).min(1).describe("天気概況の配列"),
  main: CurrentWeatherMainSchema,
  wind: WindSchema,
  dt: z.number().describe("データ計算時刻 (Unix UTC)"),
  name: z.string().describe("都市名"),
});

// TypeScriptの型としても利用可能にする
type CurrentWeatherResponse = z.infer<typeof CurrentWeatherResponseSchema>;
```
*コメント*: 各フィールドには `.describe()` を使って説明を加えておくと、後で型を参照する際に便利です。

### 天気予報 (Forecast)

天気予報APIは、3時間ごとの予報データが配列として返されます。

```typescript
// 予報リスト内の各アイテムのスキーマ (現在の天気とほぼ同様の構造が多い)
const ForecastListItemSchema = z.object({
  dt: z.number().describe("予報時刻 (Unix UTC)"),
  main: CurrentWeatherMainSchema, // 現在の天気と同様のmainオブジェクト
  weather: z.array(WeatherConditionSchema).min(1),
  wind: WindSchema,
  dt_txt: z.string().describe("予報時刻のテキスト表現 (例: \"2024-06-11 12:00:00\")"),
});

// 天気予報APIレスポンス全体のスキーマ (主要部分)
const ForecastResponseSchema = z.object({
  list: z.array(ForecastListItemSchema).describe("3時間ごとの予報データリスト"),
  city: z.object({ // 都市情報
    id: z.number(),
    name: z.string(),
    country: z.string(),
  }),
});

// TypeScriptの型としても利用可能にする
type ForecastResponse = z.infer<typeof ForecastResponseSchema>;
type ForecastListItem = z.infer<typeof ForecastListItemSchema>;
```

## 3. MCPツールの入力スキーマ定義

次に、作成するMCPツールの入力パラメータの型を `zod` で定義します。

### `get_current_weather` ツールの入力

```typescript
const GetCurrentWeatherInputSchema = z.object({
  city: z.string().min(1, "都市名は必須です。").describe("天気を取得したい都市名"),
});

type GetCurrentWeatherInput = z.infer<typeof GetCurrentWeatherInputSchema>;
```

### `get_forecast` ツールの入力

```typescript
const GetForecastInputSchema = z.object({
  city: z.string().min(1, "都市名は必須です。").describe("天気予報を取得したい都市名"),
  days: z.number().min(1).max(5).optional().default(3).describe("予報日数（1～5日、デフォルト3日）"),
});

type GetForecastInput = z.infer<typeof GetForecastInputSchema>;
```
*コメント*: `days` パラメータはオプショナルとし、デフォルト値を設定しています。また、最小値・最大値のバリデーションも加えています。

## 4. MCPツールの出力に関する型 (参考)

MCPツールは最終的に文字列や特定の構造（例: `Content` オブジェクトの配列）を返しますが、その元となるデータの型を定義しておくことは、サーバー内部の処理を整理する上で役立ちます。
今回はAPIレスポンスを整形して返すことを想定しているため、APIレスポンスの型 (`CurrentWeatherResponse`, `ForecastResponse`) や、そこから必要な情報だけを抽出したカスタムオブジェクトの型を別途定義することも考えられます。

例えば、クライアントに返す整形済み天気情報の型として、以下のようなものを定義できます。

```typescript
// 整形後の現在の天気情報
const FormattedCurrentWeatherSchema = z.object({
  city: z.string(),
  temperature: z.number(),
  description: z.string(),
  humidity: z.number(),
  windSpeed: z.number(),
  updatedAt: z.string(), // ISO 8601 形式の時刻文字列
});
type FormattedCurrentWeather = z.infer<typeof FormattedCurrentWeatherSchema>;

// 整形後の予報アイテム
const FormattedForecastItemSchema = z.object({
  dateTime: z.string(), // ISO 8601 形式の時刻文字列
  temperature: z.number(),
  description: z.string(),
});
type FormattedForecastItem = z.infer<typeof FormattedForecastItemSchema>;

// 整形後の天気予報リスト
const FormattedForecastSchema = z.object({
  city: z.string(),
  forecasts: z.array(FormattedForecastItemSchema),
});
type FormattedForecast = z.infer<typeof FormattedForecastSchema>;
```
これらの整形済みデータ型は、APIレスポンスから必要な情報を取り出し、クライアントにとってより分かりやすい形に変換する際に使用します。

---

これらの型定義は、`src/index.ts` の上部に記述するか、あるいは `src/types.ts` のような別のファイルにまとめて記述し、`index.ts` からインポートすることもできます。プロジェクトの規模が大きくなる場合は、型定義を別ファイルに分ける方が見通しが良くなります。

次のページでは、これらの型定義を使いながら、OpenWeatherMap APIと通信するためのAPIクライアントモジュールを作成します。