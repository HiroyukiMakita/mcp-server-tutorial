// weather-server/src/index.test.ts
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { AxiosResponse } from 'axios';

vi.mock('axios', () => {
  const localMockAxiosGet = vi.fn();
  const localMockAxiosCreate = vi.fn(() => ({
    get: localMockAxiosGet,
  }));

  // モック用のエラー作成関数
  const createAxiosError = (message: string, response: any) => {
    const error = new Error(message);
    Object.assign(error, {
      isAxiosError: true,
      name: 'AxiosError',
      response
    });
    return error;
  };

  return {
    default: {
      create: localMockAxiosCreate,
      isAxiosError: (error: any) => error?.isAxiosError === true,
    },
    create: localMockAxiosCreate,
    get: localMockAxiosGet,
    isAxiosError: (error: any) => error?.isAxiosError === true,
    AxiosError: {
      prototype: Error.prototype,
      new: createAxiosError
    },
  };
});

import axios from 'axios';
import { getCurrentWeather, getForecast, initializeWeatherApi } from './apiClient.js';

describe('API Client Functions', () => {
  let mockAxiosGet: Mock;
  let mockAxiosCreate: Mock;
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.OPENWEATHER_API_KEY = 'test-api-key';
    
    mockAxiosCreate = vi.mocked(axios.create);
    mockAxiosGet = vi.mocked(mockAxiosCreate().get);
    
    initializeWeatherApi();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getCurrentWeather', () => {
    it('指定した都市の現在の天気を正しく取得し、整形されたデータを返すこと', async () => {
      const mockCity = 'Tokyo';
      const mockApiResponseData = {
        name: mockCity,
        main: { temp: 25, feels_like: 26, temp_min: 24, temp_max: 27, pressure: 1012, humidity: 60 },
        weather: [{ id: 800, main: 'Clear', description: '快晴', icon: '01d' }],
        wind: { speed: 5, deg: 180 },
        dt: Math.floor(Date.now() / 1000),
      };
      mockAxiosGet.mockResolvedValue({ data: mockApiResponseData } as AxiosResponse);

      const result = await getCurrentWeather(mockCity);

      expect(mockAxiosCreate).toHaveBeenCalled();
      expect(mockAxiosGet).toHaveBeenCalledWith('/weather', { params: { q: mockCity } });
      expect(result).toEqual(mockApiResponseData);
      expect(result).not.toHaveProperty('error');
    });

    it('API呼び出しでエラーが発生した場合、エラーオブジェクトを返すこと', async () => {
      const mockCity = 'UnknownCity';
      const errorResponseData = { message: 'city not found' };
      const apiError = {
        message: 'Request failed with status code 404',
        isAxiosError: true,
        name: 'AxiosError',
        response: {
          data: errorResponseData,
          status: 404,
          statusText: 'Not Found',
          headers: {},
          config: { headers: {} }
        }
      };
      mockAxiosGet.mockRejectedValue(apiError);

      const result = await getCurrentWeather(mockCity);

      expect(mockAxiosCreate).toHaveBeenCalled();
      expect(mockAxiosGet).toHaveBeenCalledWith('/weather', { params: { q: mockCity } });
      expect(result).toEqual({ error: '天気取得APIエラー: city not found' });
    });

    it('APIレスポンスのパースに失敗した場合、エラーオブジェクトを返すこと', async () => {
        const mockCity = 'ParseErrorCity';
        const malformedApiResponseData = {
            name: mockCity,
            weather: [{ id: 800, main: 'Clear', description: '快晴', icon: '01d' }],
        };
        mockAxiosGet.mockResolvedValue({ data: malformedApiResponseData } as AxiosResponse);

        const result = await getCurrentWeather(mockCity);
        expect(mockAxiosCreate).toHaveBeenCalled();
        expect(mockAxiosGet).toHaveBeenCalledWith('/weather', { params: { q: mockCity } });
        expect(result).toHaveProperty('error');
        expect((result as {error: string}).error).toMatch(/APIレスポンス\(現在の天気\)の形式が不正です/);
    });
  });

  describe('initializeWeatherApi', () => {
    it('APIキーが設定されていない場合にエラーをスローすること', () => {
      delete process.env.OPENWEATHER_API_KEY;
      expect(() => initializeWeatherApi()).toThrow('APIキーが必要です');
    });

    it('.envまたは引数でAPIキーが設定されている場合に正しく初期化されること', () => {
      const api = initializeWeatherApi('custom-api-key');
      expect(mockAxiosCreate).toHaveBeenCalledWith({
        baseURL: 'https://api.openweathermap.org/data/2.5',
        params: {
          appid: 'custom-api-key',
          units: 'metric',
          lang: 'ja'
        },
        timeout: 10000
      });
    });
  });

  describe('getForecast', () => {
    it('指定した都市と日数の天気予報を正しく取得し、整形されたデータを返すこと', async () => {
      const mockCity = 'Osaka';
      const mockDays = 1;
      const mockApiResponseData = {
        cod: "200",
        message: 0,
        cnt: 8,
        list: [{
          dt: 1678886400,
          main: {
            temp: 20,
            feels_like: 22,
            temp_min: 18,
            temp_max: 23,
            pressure: 1013,
            humidity: 65
          },
          weather: [{
            id: 801,
            main: "Clouds",
            description: "薄い雲",
            icon: "02d"
          }],
          dt_txt: "2023-03-15 12:00:00",
          wind: {
            speed: 3,
            deg: 120
          },
          pop: 0.1
        }],
        city: {
          id: 1853909,
          name: mockCity,
          country: "JP",
          coord: {
            lat: 34.6851,
            lon: 135.5044
          }
        }
      };
      mockAxiosGet.mockResolvedValue({ data: mockApiResponseData } as AxiosResponse);

      const result = await getForecast(mockCity, mockDays);
      expect(mockAxiosCreate).toHaveBeenCalled();
      expect(mockAxiosGet).toHaveBeenCalledWith('/forecast', { params: { q: mockCity, cnt: mockDays * 8 } });
      expect(result).toEqual(mockApiResponseData);
      expect(result).not.toHaveProperty('error');
    });

    it('API呼び出しでエラーが発生した場合、エラーメッセージを返すこと', async () => {
        const mockCity = 'ForecastUnknownCity';
        const errorResponseData = { message: 'city not found for forecast' };
        const apiError = {
          message: 'Request failed with status code 404',
          isAxiosError: true,
          name: 'AxiosError',
          response: {
            data: errorResponseData,
            status: 404,
            statusText: 'Not Found',
            headers: {},
            config: { headers: {} }
          }
        };
        mockAxiosGet.mockRejectedValue(apiError);

        const result = await getForecast(mockCity, 3);
        expect(mockAxiosCreate).toHaveBeenCalled();
        expect(mockAxiosGet).toHaveBeenCalledWith('/forecast', { params: { q: mockCity, cnt: 3 * 8 } });
        expect(result).toEqual({ error: '天気予報APIエラー: city not found for forecast' });
    });

    it('APIキーが設定されていない場合、適切なエラーメッセージを返すこと', async () => {
      delete process.env.OPENWEATHER_API_KEY;
      const result = await getForecast('Tokyo', 3);
      expect(result).toEqual({ error: '.envファイルにOPENWEATHER_API_KEYを設定してください。' });
    });

    it('APIレスポンスのパースに失敗した場合、エラーメッセージを返すこと', async () => {
      const mockCity = 'ParseErrorCity';
      const malformedApiResponseData = {
        cod: "200",
        message: 0,
        cnt: 8,
        list: [{
          dt: 1678886400,
          main: {
            temp: "20", // 数値ではなく文字列（不正な形式）
            pressure: 1013,
            humidity: 65
          },
          weather: [{ id: 801, main: "Clouds", description: "薄い雲", icon: "02d" }],
          wind: { speed: 3, deg: 120 }
        }],
        city: {
          name: mockCity,
          country: "JP",
          coord: { lat: 34.6851, lon: 135.5044 }
        }
      };
      mockAxiosGet.mockResolvedValue({ data: malformedApiResponseData } as AxiosResponse);

      const result = await getForecast(mockCity, 1);
      expect(result).toHaveProperty('error');
      expect((result as { error: string }).error).toMatch(/APIレスポンス\(天気予報\)の形式が不正です/);
    });
  });
});
