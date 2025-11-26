import { Capacitor, CapacitorHttp } from '@capacitor/core';
import kirtanData from '../data/Kirtan Classification - classified_ragi_duties.csv?raw';

const isWeb = Capacitor.getPlatform() === 'web';
const BASE_DOMAIN = isWeb ? '/api/sgpc' : 'https://sgpc.net';

export const KIRTAN_BASE = `${BASE_DOMAIN}/kirtan/`;
export const RAGIWISE_BASE = `${BASE_DOMAIN}/ragiwise/`;
export const CLASSIFICATION_BASE = `${BASE_DOMAIN}/classification/`;

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
          const baseObj = new URL(baseUrl);
          const currentDir = baseObj.searchParams.get('dir');

          if (currentDir && !href.startsWith('?') && !href.startsWith('http') && !href.startsWith('/')) {
            // Append to existing dir param
            // Remove trailing slash from currentDir if present to avoid double slash
            const cleanDir = currentDir.replace(/\/$/, '');
            const newDir = `${cleanDir}/${href}`;
            baseObj.searchParams.set('dir', newDir);
            fullUrl = baseObj.href;
          } else {
            fullUrl = new URL(href, baseUrl).href;
          }
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
// CSV PARSER FOR CLASSIFICATIONS
// --------------------------------------------------------

interface CsvRow {
  ragi: string;
  day: string;
  name: string;
  url: string;
  Duty_Type: string;
}

let cachedCsvData: CsvRow[] | null = null;

const parseCsvData = (): CsvRow[] => {
  if (cachedCsvData) return cachedCsvData;

  const lines = kirtanData.split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const data: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV split handling quotes if necessary, but for now standard split
    // The file seems to be standard CSV. 
    // Note: The file has 5 columns: ragi,day,name,url,Duty_Type
    // We need to be careful about commas in values if any. 
    // Looking at the file, it seems simple enough.

    // A more robust regex for CSV splitting if needed:
    // const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);

    // For this specific file structure based on view_file:
    const parts = line.split(',');
    if (parts.length >= 5) {
      // Reconstruct if split went wrong due to commas in name? 
      // The URL is at index 3 (0-indexed) usually, Duty_Type at last.
      // Let's assume standard format for now.
      // ragi, day, name, url, Duty_Type
      // If name has comma, it might shift.

      // Let's take the last element as Duty_Type
      const dutyType = parts[parts.length - 1].trim();
      // URL is usually the second to last, but let's be safer.
      // The URL starts with http.
      const urlIndex = parts.findIndex(p => p.startsWith('http'));

      if (urlIndex !== -1) {
        const url = parts[urlIndex].trim();
        const name = parts.slice(2, urlIndex).join(',').trim(); // Join parts between day and url
        const ragi = parts[0].trim();

        data.push({
          ragi,
          day: parts[1] || '',
          name,
          url,
          Duty_Type: dutyType
        });
      }
    }
  }
  cachedCsvData = data;
  return data;
};

const fetchClassifications = (url: string): DirectoryEntry[] => {
  const data = parseCsvData();
  const prefix = CLASSIFICATION_BASE;

  // 1. ROOT: List Duty Types
  if (url === prefix || url === prefix.replace(/\/$/, '')) {
    const duties = new Set(data.map(d => d.Duty_Type).filter(Boolean));
    const dutyList = Array.from(duties).sort();
    // Add "All Kirtan Hazris" at the top or sorted
    dutyList.unshift("All Kirtan Hazris");

    return dutyList.map(duty => ({
      name: duty,
      url: `${prefix}${encodeURIComponent(duty)}`,
      is_file: false,
      is_mp3: false
    }));
  }

  if (url.startsWith(prefix)) {
    const pathPart = url.substring(prefix.length); // e.g. "Tin%20Pehar" or "Tin%20Pehar/Bhai%20X"
    const parts = pathPart.split('/').filter(Boolean).map(decodeURIComponent);

    const dutyType = parts[0];

    // 2. DUTY TYPE SELECTED
    if (parts.length === 1) {
      // Special Case: All Kirtan Hazris -> Return ALL tracks
      if (dutyType === "All Kirtan Hazris") {
        return data.map(d => ({
          name: d.name,
          url: d.url,
          is_file: true,
          is_mp3: true
        }));
      }

      const filteredByDuty = data.filter(d => d.Duty_Type === dutyType);
      // Get unique Ragis for this duty
      const ragis = new Set(filteredByDuty.map(d => d.ragi).filter(Boolean));

      return Array.from(ragis).sort().map(ragi => ({
        name: ragi,
        // URL: .../classification/DutyType/RagiName
        url: `${prefix}${encodeURIComponent(dutyType)}/${encodeURIComponent(ragi)}`,
        is_file: false,
        is_mp3: false
      }));
    }

    // 3. RAGI SELECTED: List Tracks
    if (parts.length >= 2) {
      const ragiName = parts[1];
      const tracks = data.filter(d => d.Duty_Type === dutyType && d.ragi === ragiName);

      return tracks.map(d => ({
        name: d.name,
        url: d.url,
        is_file: true,
        is_mp3: true
      }));
    }
  }

  return [];
};

// --------------------------------------------------------
// FETCH FUNCTION
// --------------------------------------------------------

export const fetchDirectory = async (url: string): Promise<DirectoryEntry[]> => {
  if (url.startsWith(CLASSIFICATION_BASE)) {
    return fetchClassifications(url);
  }

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