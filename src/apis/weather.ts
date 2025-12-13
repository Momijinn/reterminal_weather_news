export const fetchWeather = async () => {
  const response = await fetch(
    `https://api.openweathermap.org/data/3.0/onecall?lat=${import.meta.env.OWM_LAT}&lon=${import.meta.env.OWM_LON}&appid=${import.meta.env.OWM_API_KEY}&units=metric&exclude=minutely,daily&lang=ja`
  );
  if (!response.ok) {
    throw new Error('Failed to fetch weather data');
  }
  return await response.json();
};
