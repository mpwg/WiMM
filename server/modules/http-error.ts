export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public fields: Record<string, string | string[]> = {},
  ) {
    super(message)
  }
}
