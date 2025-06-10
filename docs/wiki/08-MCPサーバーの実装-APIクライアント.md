# 08. MCPサーバーの実装 - APIクライアント

前のページでOpenWeatherMap APIのレスポンスやツールの入力に関する型を定義しました。
このセクションでは、実際にOpenWeatherMap APIと通信を行うためのAPIクライアントモジュールを作成します。HTTPリクエストの送信には `axios` ライブラリを使用します。

APIクライアントは、APIキーやベースURLといった共通の設定を持ち、指定された都市の現在の天気や天気予報を取得する関数を提供します。

## 1. `axios` のインポートとAPIキーの準備

まず、`weather-server/src/index.ts` ファイル（またはAPIクライアント用の別ファイルを作成する場合はそのファイル）で `axios` と、前ページで定義した型（特にAPIレスポンスの型）をインポートします。また、環境変数からAPIキーを読み込む処理も記述しておきます。

```typescript
// weather-server/src/index.ts (または api.ts など)
import axios, { AxiosInstance } from 'axios';
import { z } from 'zod'; // zodも必要に応じてインポート

// 前のページで定義した型をインポート (別ファイルの場合)
// import { CurrentWeatherResponseSchema, ForecastResponseSchema, CurrentWeatherResponse, ForecastResponse } from './types';

// (ここでは仮にindex.tsに直接書くとして、前ページで定義したzodスキーマがここにあると仮定します)
// const CurrentWeatherResponseSchema = z.object({ ... }); // 前ページで定義
// type CurrentWeatherResponse = z.infer<typeof CurrentWeatherResponseSchema>;
// const ForecastResponseSchema = z.object({ ... }); // 前ページで定義
// type ForecastResponse = z.infer<typeof ForecastResponseSchema>;


const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

if (!OPENWEATHER_API_KEY) {
  console.error('エラー: 環境変数 OPENWEATHER_API_KEY が設定されていません。');
  // 実際のアプリケーションでは、ここでエラーをスローするか、
  // サーバー起動を中止するなどの処理が必要です。
  // このチュートリアルでは、後のMCPサーバー初期化時にチェックすることにします。
}

const OPENWEATHER_API_BASE_URL = 'https://api.openweathermap.org/data/2.5';
```

## 2. `axios` インスタンスの作成

APIリクエストを行うための `axios` インスタンスを作成します。このインスタンスには、ベースURLや共通のパラメータ（APIキー、単位など）をあらかじめ設定しておくと便利です。

```typescript
let weatherApi: AxiosInstance;

if (OPENWEATHER_API_KEY) { // APIキーが存在する場合のみインスタンスを作成
  weatherApi = axios.create({
    baseURL: OPENWEATHER_API_BASE_URL,
    params: {
      appid: OPENWEATHER_API_KEY,
      units: 'metric', // 温度を摂氏で取得
      lang: 'ja',    // 可能であれば日本語で情報を取得 (APIが対応している場合)
    },
    timeout: 10000, // リクエストのタイムアウトを10秒に設定
  });
} else {
  // APIキーがない場合、weatherApiは未定義のまま。
  // これを利用して、後続の処理でAPI呼び出しをスキップするなどの制御が可能。
  // ただし、このチュートリアルではAPIキー必須として進めます。
  // サーバー起動時にAPIキーの有無をチェックし、なければエラー終了させるのがより堅牢です。
}
```
*注意*: `lang: 'ja'` はAPIが日本語対応している場合に有効です。対応していない場合は英語で返却されるか、エラーになる可能性があります。OpenWeatherMapのドキュメントで対応言語を確認してください。

## 3. 現在の天気を取得する関数

指定された都市の現在の天気を取得する非同期関数を作成します。

```typescript
/**
 * 指定された都市の現在の天気を取得します。
 * @param city 都市名
 * @returns APIレスポンス (CurrentWeatherResponse型でパース試行) または エラー
 */
async function getCurrentWeather(city: string): Promise<CurrentWeatherResponse | { error: string }> {
  if (!weatherApi) { // APIキーが設定されていない場合
    return { error: "APIキーが設定されていないため、天気を取得できません。" };
  }

  try {
    const response = await weatherApi.get('/weather', {
      params: {
        q: city,
      },
    });

    // zodスキーマでレスポンスデータをパース・検証
    const parseResult = CurrentWeatherResponseSchema.safeParse(response.data);
    if (!parseResult.success) {
      console.error("現在の天気APIレスポンスのパースに失敗:", parseResult.error.flatten());
      return { error: `APIレスポンスの形式が不正です: ${parseResult.error.message}` };
    }
    return parseResult.data;

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`現在の天気取得APIエラー (都市: ${city}):`, error.response?.data || error.message);
      const errorMessage = (error.response?.data as any)?.message || error.message;
      return { error: `天気の取得に失敗しました: ${errorMessage}` };
    }
    console.error(`予期せぬエラー (現在の天気取得 - 都市: ${city}):`, error);
    return { error: '天気の取得中に予期せぬエラーが発生しました。' };
  }
}
```
この関数では、`axios` を使ってAPIリクエストを行い、受け取ったレスポンスを前ページで定義した `CurrentWeatherResponseSchema` を使ってパース・検証しています。`safeParse` を使うことで、パース失敗時にもエラーをスローせず、結果オブジェクトで成否を判断できます。

## 4. 天気予報を取得する関数

指定された都市と日数の天気予報を取得する非同期関数を作成します。

```typescript
/**
 * 指定された都市の数日間の天気予報を取得します。
 * @param city 都市名
 * @param days 予報日数 (OpenWeatherMap APIでは3時間ごと40件までなので、日数に換算してcntを指定)
 * @returns APIレスポンス (ForecastResponse型でパース試行) または エラー
 */
async function getForecast(city: string, days: number = 3): Promise<ForecastResponse | { error: string }> {
  if (!weatherApi) { // APIキーが設定されていない場合
    return { error: "APIキーが設定されていないため、天気予報を取得できません。" };
  }

  // OpenWeatherMapの無料枠では、3時間ごとのデータが最大5日分 (40レコード) まで取得可能
  // 1日あたり8レコード (24時間 / 3時間)
  const cnt = Math.min(days, 5) * 8; // 最大5日分、それ以上は5日分とする

  try {
    const response = await weatherApi.get('/forecast', {
      params: {
        q: city,
        cnt: cnt,
      },
    });

    // zodスキーマでレスポンスデータをパース・検証
    const parseResult = ForecastResponseSchema.safeParse(response.data);
    if (!parseResult.success) {
      console.error("天気予報APIレスポンスのパースに失敗:", parseResult.error.flatten());
      return { error: `APIレスポンスの形式が不正です: ${parseResult.error.message}` };
    }
    return parseResult.data;

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`天気予報取得APIエラー (都市: ${city}):`, error.response?.data || error.message);
      const errorMessage = (error.response?.data as any)?.message || error.message;
      return { error: `天気予報の取得に失敗しました: ${errorMessage}` };
    }
    console.error(`予期せぬエラー (天気予報取得 - 都市: ${city}):`, error);
    return { error: '天気予報の取得中に予期せぬエラーが発生しました。' };
  }
}
```
こちらも同様に、APIリクエスト後に `ForecastResponseSchema` でレスポンスを検証しています。

---

これらのAPIクライアント関数を `src/index.ts` に記述するか、あるいは `src/apiClient.ts` のような別ファイルにまとめて、`index.ts` からインポートして使用します。
コードの見通しを良くするためには、別ファイルにすることをお勧めします。

次のページでは、これらのAPIクライアント関数を利用して、実際にMCPツール (`get_current_weather`, `get_forecast`) を定義していきます。