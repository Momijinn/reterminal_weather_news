export const fetchNews = async () => {
  const response = await fetch('https://news.yahoo.co.jp/rss/media/stv/all.xml');
  if (!response.ok) {
    throw new Error('Failed to fetch news');
  }
  return await response.text();
};
