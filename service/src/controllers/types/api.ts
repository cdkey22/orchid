// Types globaux pour l'application
import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

//A enrichir en fonction des usages sur le pattern d'une erreur (codeErreur, fishtag, ...),
export interface ErrorResponse {
  message: string;
  statusCode: number;
}

export function generateError(res: Response, statusCode: number, message: string) {
  res.status(statusCode).json({
    message: message,
  });
}
