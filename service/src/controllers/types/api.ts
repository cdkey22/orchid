// Types globaux pour l'application
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}
