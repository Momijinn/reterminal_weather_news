import { XMLParser } from 'fast-xml-parser';
import { fetchNews } from '../apis/news';

export interface NewsItem {
  title: string;
  url: string;
  pubDate: string;
}

const generateErrorNewsItem = (): NewsItem[] => {
  const item = {
    title: 'ニュースの取得に失敗しました',
    url: '',
    pubDate: '',
  };
  return [item, item];
};

// linkに対してパラメータを削除する
const sanitizeLink = (link: string): string => {
  const url = new URL(link);
  url.search = '';
  return url.toString();
};

export const getNews = async (): Promise<NewsItem[]> => {
  let response = '';

  try {
    response = await fetchNews();
  } catch (error) {
    console.error('Error fetching news:', error);
    return generateErrorNewsItem();
  }

  const parser = new XMLParser();
  const xml = parser.parse(response);
  const rawItems = xml.rss.channel.item;
  if (!rawItems) {
    return generateErrorNewsItem();
  }
  const itemsArray = Array.isArray(rawItems) ? rawItems : [rawItems];

  return itemsArray.slice(0, 2).map(({ title, link, pubDate }) => ({
    title,
    url: sanitizeLink(link),
    pubDate,
  }));
};
