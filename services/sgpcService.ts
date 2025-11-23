import { CapacitorHttp } from '@capacitor/core';

export const KIRTAN_BASE = "https://sgpc.net/kirtan/";
export const RAGIWISE_BASE = "https://sgpc.net/ragiwise/";

export interface DirectoryEntry {
  name: str;
  url: str;
  is_file: boolean;
  is_mp3: boolean;
}

// Helper to parse the HTML returned by DirectoryLister
const parseDirectoryHtml = (html: string, baseUrl: string): DirectoryEntry[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const listItems = doc.querySelectorAll('#directory-listing li');
  const entries: DirectoryEntry[] = [];

  listItems.forEach((li) => {
    const name = li.getAttribute('data-name');
    const href = li.getAttribute('data-href');

    if (name && href && name !== '..') {
      const is_mp3 = name.toLowerCase().endsWith('.mp3');
      // Construct full URL. 
      // Note: DirectoryLister usually puts the relative path in href or name
      // We essentially just need to append the name to the current base url if it's a file,
      // or use the href if it's a folder logic.
      
      let fullUrl = '';
      if (baseUrl.endsWith('/')) {
        fullUrl = baseUrl + (is_mp3 ? name : href);
      } else {
        fullUrl = baseUrl + '/' + (is_mp3 ? name : href);
      }

      entries.push({
        name: name,
        url: fullUrl,
        is_file: is_mp3, // Simplified: assume mp3 is file, others are folders
        is_mp3: is_mp3
      });
    }
  });

  return entries;
};

export const fetchDirectory = async (url: string): Promise<DirectoryEntry[]> => {
  try {
    const response = await CapacitorHttp.get({ url });
    if (response.status === 200) {
      return parseDirectoryHtml(response.data, url);
    }
    throw new Error('Failed to fetch directory');
  } catch (error) {
    console.error("SGPC Scrape Error:", error);
    return [];
  }
};