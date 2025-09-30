export interface Anomaly {
  items: string;
  debit: number;
  credit: number;
}

export interface ApiResponse {
  balance_status: string;
  anomalies: Anomaly[];
  recommendations: string;
}