
export interface AudioState {
  isPlaying: boolean;
  volume: number; // 0 to 1
  isLoading: boolean;
  error: string | null;
}

export enum ConnectionStatus {
  DISCONNECTED = 'Disconnected',
  CONNECTING = 'Connecting',
  CONNECTED = 'Live',
  ERROR = 'Stream Offline'
}

export interface HukamnamaResponse {
  date: {
    gregorian: {
      month: number;
      date: number;
      year: number;
      monthno: number;
      day: number;
    };
    nanakshahi: {
      year: number;
      month: string;
      date: number;
      punjabi: string;
    };
  };
  hukamnama: Array<{
    line: {
      gurmukhi: { unicode: string };
      translation: {
        english: { default: string };
        punjabi: { default: { unicode: string } };
      };
    };
  }>;
}
