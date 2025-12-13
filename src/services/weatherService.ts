import type { Dayjs } from 'dayjs';
import { fetchWeather } from '../apis/weather';
import dayjs from 'dayjs';

interface Weather {
  date: Dayjs; // 日付と時刻
  icon: string; // 天気アイコン
  description: string; // 天気の説明
  temp: string; // 気温
  windSpeed: number; // 風速
  windDeg: string; // 風向き
}

interface Alert {
  sensor: string; // 警報・注意報の発令元
  event: string; // 警報・注意報の名称
}

export interface WeatherData {
  current: Weather;
  hourly: Weather[];
  alerts: Alert[];
}

// icon の対応付け
const iconMapping: { [key: string]: string } = {
  '01d': 'wi:day-sunny', // 晴天
  '01n': 'wi:day-sunny', // 晴天（夜）
  '02d': 'wi:day-cloudy', // ほぼ晴れ
  '02n': 'wi:day-cloudy', // ほぼ晴れ（夜）
  '03d': 'wi:cloud', // 曇り
  '03n': 'wi:cloud', // 曇り（夜）
  '04d': 'wi:forecast-io-partly-cloudy-day', // くもりがち
  '04n': 'wi:forecast-io-partly-cloudy-night', // くもりがち（夜）
  '09d': 'wi:day-rain-mix', // にわか雨
  '09n': 'wi:night-alt-rain-mix', // にわか雨（夜）
  '10d': 'wi:rain', // 雨
  '10n': 'wi:rain', // 雨（夜）
  '11d': 'wi:thunderstorm', // 雷雨
  '11n': 'wi:thunderstorm', // 雷雨（夜）
  '13d': 'wi:snow', // 雪
  '13n': 'wi:snow', // 雪（夜）
  '50d': 'wi:day-haze', // 霧
  '50n': 'wi:night-fog', // 霧（夜）
};

// 風向から方角を取得する関数
const truncateWindDeg = (deg: number): string => {
  const directions = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
  const index = Math.floor((deg + 22.5) / 45) % 8;
  return directions[index];
};

// UTC時刻を日本時間に変換する関数
const convertToJST = (utcSeconds: number): Dayjs => {
  const dt = dayjs.unix(utcSeconds);
  return dt;
};

const generateErrorWeatherData = (): WeatherData => {
  const now = dayjs();
  const addOneHour = now.add(1, 'hour').set('minute', 0).set('second', 0);

  return {
    current: {
      date: now,
      icon: 'wi:na',
      description: 'データ取得エラー',
      temp: '--',
      windSpeed: 0,
      windDeg: 'N/A',
    } as Weather,
    hourly: [
      // 6件分のダミーデータを生成
      ...Array.from({ length: 6 }, (_, i) => ({
        date: addOneHour.add(i * 3, 'hour'),
        icon: 'wi:na',
        description: 'データ取得エラー',
        temp: '--',
        windSpeed: 0,
        windDeg: 'N/A',
      })),
    ] as Weather[],
    alerts: [] as Alert[],
  };
};

export const getWeather = async (): Promise<WeatherData> => {
  let response: Awaited<ReturnType<typeof fetchWeather>> | undefined;

  try {
    response = await fetchWeather();
  } catch (error) {
    console.error('Error fetching weather:', error);
    return generateErrorWeatherData();
  }

  if (!response) {
    return generateErrorWeatherData();
  }

  // 現在の天気データを変換
  const currentWeather = {
    date: convertToJST(response.current.dt),
    icon: iconMapping[response.current.weather[0].icon] || 'wi:na',
    description: response.current.weather[0].description,
    temp: Math.trunc(response.current.temp).toString(),
    windSpeed: response.current.wind_speed,
    windDeg: truncateWindDeg(response.current.wind_deg),
  };

  // 1時間ごとの天気データを変換
  const hourlyWeather = response.hourly.map(
    (hour: {
      weather: {
        icon: string;
        description: any;
      }[];
      dt: any;
      temp: any;
      wind_speed: any;
      wind_deg: any;
    }) => ({
      date: convertToJST(hour.dt),
      icon: iconMapping[hour.weather[0].icon] || 'wi:na',
      description: hour.weather[0].description,
      temp: Math.trunc(hour.temp),
      windSpeed: hour.wind_speed,
      windDeg: truncateWindDeg(hour.wind_deg),
    })
  );
  // 現在時刻を起点に、次の3時間おきのデータを6件取得。
  const now = dayjs();
  const nextThreeHoursData = hourlyWeather
    .filter((hour: { date: Dayjs }) => hour.date.valueOf() > now.valueOf())
    .filter((_: any, index: number) => index % 3 === 0)
    .slice(0, 6);

  // 警報・注意報データを変換
  const alerts: Alert[] = response.alerts
    ? response.alerts.map((alert: { sender_name: string; event: string }) => ({
        sensor: alert.sender_name,
        event: alert.event,
      }))
    : [];

  return {
    current: currentWeather,
    hourly: nextThreeHoursData,
    alerts: alerts,
  };
};
