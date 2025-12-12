import { XMLParser } from 'fast-xml-parser';
import { fetchNews } from '../apis/news';

export interface NewsItem {
  title: string;
  url: string;
  pubDate: string;
}

export const getNews = async (): Promise<NewsItem[]> => {
  let response = '';

  try {
    response = await fetchNews();
  } catch (error) {
    console.error('Error fetching news:', error);
    return [];
  }

  const parser = new XMLParser();
  const xml = parser.parse(response);
  const rawItems = xml.rss.channel.item;
  if (!rawItems) {
    return [];
  }
  const itemsArray = Array.isArray(rawItems) ? rawItems : [rawItems];

  return itemsArray.slice(0, 2).map(({ title, link, pubDate }) => ({
    title,
    url: link,
    pubDate,
  }));
};
