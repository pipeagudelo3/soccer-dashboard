// Mantiene el contrato de errores de #39 sin datos internos ni valores sensibles.
export interface ApiErrorResponseDTO {
  statusCode: number;
  message: string[];
  path: string;
  timestamp: string;
}
