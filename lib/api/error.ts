export function resolveApiErrorMessage(error: unknown, fallback = "Internal server error."): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}
