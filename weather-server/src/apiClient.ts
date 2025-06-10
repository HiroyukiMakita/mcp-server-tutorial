// weather-server/src/apiClient.ts
import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse, AxiosError } from 'axios';
import { z } from 'zod';

// --- 型定義 (index.tsから移動・または別途types.tsからインポート) ---
// 現在の天気の主要部分のスキーマ
const CurrentWeatherMainSchema = z.object({
  temp: z.number().describe("気温（摂氏）"),
  feels_like: z.number().describe("体感温度（摂氏）"),
  temp_min: z.number().describe("最低気温（摂氏）"),
  temp_max: z.number().describe("最高気温（摂氏）"),
  pressure: z.number().describe("気圧 (hPa)"),
  humidity: z.number().describe("湿度 (%)"),
  sea_level: z.number().optional().describe("海面気圧 (hPa)"),
  grnd_level: z.number().optional().describe("地上気圧 (hPa)"),
});

// 天気状態のスキーマ
const WeatherConditionSchema = z.object({
  id: z.number().describe("天気状態ID"),
  main: z.string().describe("主要な天気状態 (例: Clouds, Rain)"),
  description: z.string().describe("天気状態の詳細 (例: 曇りがち, 小雨)"),
  icon: z.string().describe("天気アイコンID"),
});

// 風情報のスキーマ
const WindSchema = z.object({
  speed: z.number().describe("風速 (m/s)"),
  deg: z.number().describe("風向 (度)"),
  gust: z.number().optional().describe("突風 (m/s)"),
});

// 現在の天気APIレスポンス全体のスキーマ
const CurrentWeatherResponseSchema = z.object({
  coord: z.object({ lon: z.number(), lat: z.number() }).optional(),
  weather: z.array(WeatherConditionSchema).min(1),
  base: z.string().optional(),
  main: CurrentWeatherMainSchema,
  visibility: z.number().optional(),
  wind: WindSchema,
  clouds: z.object({ all: z.number() }).optional(),
  rain: z.object({ "1h": z.number() }).optional(),
  snow: z.object({ "1h": z.number() }).optional(),
  dt: z.number().describe("データ計算時刻 (Unix UTC)"),
  sys: z.object({
    type: z.number().optional(),
    id: z.number().optional(),
    country: z.string().optional(),
    sunrise: z.number().optional(),
    sunset: z.number().optional(),
  }).optional(),
  timezone: z.number().optional(),
  id: z.number().optional(),
  name: z.string().describe("都市名"),
  cod: z.number().optional(),
});
export type CurrentWeatherResponse = z.infer<typeof CurrentWeatherResponseSchema>;

// 天気予報リストアイテムのスキーマ (CurrentWeatherResponseの要素を参考に調整)
const ForecastListItemSchema = z.object({
  dt: z.number().describe("予報時刻 (Unix UTC)"),
  main: CurrentWeatherMainSchema,
  weather: z.array(WeatherConditionSchema).min(1),
  clouds: z.object({ all: z.number() }).optional(),
  wind: WindSchema,
  visibility: z.number().optional(),
  pop: z.number().optional().describe("降水確率 (0-1)"), // 降水確率
  rain: z.object({ "3h": z.number() }).optional(), // 3時間降水量
  snow: z.object({ "3h": z.number() }).optional(), // 3時間降雪量
  sys: z.object({ pod: z.string() }).optional(), // part of day (d or n)
  dt_txt: z.string().describe("予報時刻のテキスト表現 (例: \"2024-06-11 12:00:00\")"),
});

// 天気予報APIレスポンス全体のスキーマ (主要部分)
const ForecastResponseSchema = z.object({
  cod: z.string(),
  message: z.number(),
  cnt: z.number().describe("返されるタイムスタンプの数"),
  list: z.array(ForecastListItemSchema),
  city: z.object({
    id: z.number(),
    name: z.string(),
    coord: z.object({ lat: z.number(), lon: z.number() }),
    country: z.string(),
    population: z.number().optional(),
    timezone: z.number().optional(),
    sunrise: z.number().optional(),
    sunset: z.number().optional(),
  }),
});
export type ForecastResponse = z.infer<typeof ForecastResponseSchema>;
// --- 型定義ここまで ---


// --- APIキーとAPIクライアント ---
const OPENWEATHER_API_BASE_URL = 'https://api.openweathermap.org/data/2.5';
let weatherApi: AxiosInstance | null = null;

export function initializeWeatherApi(apiKey?: string): AxiosInstance {
  const key = apiKey || process.env.OPENWEATHER_API_KEY;
  if (!key) {
    console.error('警告: APIキーが設定されていません。API呼び出しは失敗します。');
  }

  weatherApi = axios.create({
    baseURL: OPENWEATHER_API_BASE_URL,
    params: {
      appid: key || 'DUMMY_KEY',
      units: 'metric',
      lang: 'ja'
    },
    timeout: 10000, // 10秒
  });

  return weatherApi;
}

// APIクライアントの取得（未初期化の場合は初期化も行う）
function getWeatherApi(): AxiosInstance {
  if (!weatherApi) {
    return initializeWeatherApi();
  }
  return weatherApi;
}

export async function getCurrentWeather(city: string): Promise<CurrentWeatherResponse | { error: string }> {
  const api = getWeatherApi();
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) {
    return { error: "APIキーが設定されていません。" };
  }
  console.log(`[API Client] 都市 "${city}" の現在の天気を取得します...`);
  try {
    const response = await api.get('/weather', { params: { q: city } });
    const parseResult = CurrentWeatherResponseSchema.safeParse(response.data);
    if (!parseResult.success) {
      console.error("[API Client] 現在の天気APIレスポンスのパースに失敗:", parseResult.error.flatten());
      return { error: `APIレスポンス(現在の天気)の形式が不正です: ${parseResult.error.message}` };
    }
    console.log(`[API Client] 都市 "${city}" の現在の天気取得成功。`);
    return parseResult.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const apiErrorMessage = (error.response?.data as any)?.message || error.message;
      console.error(`[API Client] 現在の天気取得APIエラー (都市: ${city}): ${apiErrorMessage}`, error.response?.data);
      return { error: `天気取得APIエラー: ${apiErrorMessage}` };
    }
    console.error(`[API Client] 天気取得中に予期せぬエラー (都市: ${city}):`, error);
    return { error: '天気取得中に予期せぬエラーが発生しました。' };
  }
}

export async function getForecast(city: string, days: number = 3): Promise<ForecastResponse | { error: string }> {
  const api = getWeatherApi();
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) {
    return { error: "APIキーが設定されていません。" };
  }
  console.log(`[API Client] 都市 "${city}" の ${days} 日間の天気予報を取得します...`);
  const cnt = Math.min(days, 5) * 8; // 1日8レコード (3時間ごと)
  try {
    const response = await api.get('/forecast', { params: { q: city, cnt } });
    const parseResult = ForecastResponseSchema.safeParse(response.data);
    if (!parseResult.success) {
      console.error("[API Client] 天気予報APIレスポンスのパースに失敗:", parseResult.error.flatten());
      return { error: `APIレスポンス(天気予報)の形式が不正です: ${parseResult.error.message}` };
    }
    console.log(`[API Client] 都市 "${city}" の ${days} 日間の天気予報取得成功。`);
    return parseResult.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const apiErrorMessage = (error.response?.data as any)?.message || error.message;
      console.error(`[API Client] 天気予報取得APIエラー (都市: ${city}): ${apiErrorMessage}`, error.response?.data);
      return { error: `天気予報APIエラー: ${apiErrorMessage}` };
    }
    console.error(`[API Client] 天気予報取得中に予期せぬエラー (都市: ${city}):`, error);
    return { error: '天気予報取得中に予期せぬエラーが発生しました。' };
  }
}
// --- APIクライアントここまで ---