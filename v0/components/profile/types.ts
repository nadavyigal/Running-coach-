export type HistoricRunType = 'easy' | 'tempo' | 'long' | 'intervals' | 'race';

export interface HistoricRunEntry {
  distance: number; // km
  time: number; // seconds
  date: Date;
  type?: HistoricRunType;
  notes?: string;
}

export interface HistoricRunUpload {
  id: string;
  status: 'uploading' | 'analyzing' | 'review' | 'confirmed' | 'error';
  imagePreviewUrl?: string;
  extractedData?: {
    distanceKm: number;
    durationSeconds: number;
    paceSecondsPerKm?: number;
    completedAt: Date;
    type?: string;
    confidence?: number;
  };
  userConfirmedData?: {
    distance: number; // km
    time: number; // seconds
    date: Date;
    type: HistoricRunType;
    notes?: string;
  };
  error?: string;
}
