import { CapacitorHttp } from '@capacitor/core';

export const KIRTAN_BASE = "https://sgpc.net/kirtan/";
export const RAGIWISE_BASE = "https://sgpc.net/ragiwise/";

export interface DirectoryEntry {
  name: string;
  url: string;
  is_file: boolean;
  is_mp3: boolean;
}

// --------------------------------------------------------
// URL HELPERS (Ported from Python)
// --------------------------------------------------------

/**
 * Converts browsing URL to real path for file access.
 * e.g. "https://sgpc.net/kirtan/?dir=2025" -> "https://sgpc.net/kirtan/2025"
 */
const getFolderRealPath = (url: string): string => {
  if (url.includes('?dir=')) {
    const parts = url.split('?dir=');
    const base = parts[0].replace(/\/+$/, ''); // rstrip('/')
    const folder = parts[1];
    return `${base}/${folder}`;
  }
  return url.replace(/\/+$/, '');
};

/**
 * Encodes the filename exactly like Python's urllib.parse.quote
 * and appends it to the real folder path.
 */
const encodeMp3Url = (folderUrl: string, filename: string): string => {
  const folderPath = getFolderRealPath(folderUrl);
  
  // JavaScript's encodeURIComponent is similar to Python's quote()
  // However, we manually replace parentheses () to match your Python output exactly (%28, %29)
  // This is crucial for files like "(02;00...)"
  const encodedFilename = encodeURIComponent(filename)
    .replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
    
  return `${folderPath}/${encodedFilename}`;
};

// --------------------------------------------------------
// PARSER
// --------------------------------------------------------

const parseDirectoryHtml = (html: string, baseUrl: string): DirectoryEntry[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const listItems = doc.querySelectorAll('#directory-listing li');
  const entries: DirectoryEntry[] = [];

  listItems.forEach((li) => {
    const name = li.getAttribute('data-name');
    const href = li.getAttribute('data-href');

    // Skip empty or parent directory ".."
    if (name && href && name !== '..') {
      const is_mp3 = name.toLowerCase().endsWith('.mp3');
      let fullUrl = '';

      if (is_mp3) {
         // --- LOGIC FIX: USE REAL PATH FOR MP3s ---
         // "https://sgpc.net/kirtan/?dir=2025" + "File.mp3" 
         // BECOMES -> "https://sgpc.net/kirtan/2025/File.mp3"
         fullUrl = encodeMp3Url(baseUrl, name);
      } else {
         // --- LOGIC FOR FOLDERS ---
         // Keep the ?dir= structure for browsing
         try {
            fullUrl = new URL(href, baseUrl).href;
         } catch (e) {
            // Fallback for relative paths if new URL() fails
            fullUrl = baseUrl.replace(/\/+$/, '') + '/' + href;
         }
      }

      entries.push({
        name: name,
        url: fullUrl,
        is_file: is_mp3,
        is_mp3: is_mp3
      });
    }
  });

  return entries;
};

// --------------------------------------------------------
// FETCH FUNCTION
// --------------------------------------------------------

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