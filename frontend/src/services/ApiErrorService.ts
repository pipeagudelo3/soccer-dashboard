import axios from 'axios';

// Only validation/conflict messages from the documented envelope reach presentation.
function readBackendMessages(value: unknown, status: number): string[] | null {
  if (typeof value !== 'object' || value === null || !('message' in value)) {
    return null;
  }

  if (!('statusCode' in value) || value.statusCode !== status) {
    return null;
  }

  const messages = value.message;

  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    !messages.every((message: unknown) => typeof message === 'string' && message.trim() !== '')
  ) {
    return null;
  }

  return messages.map((message: string) => message.trim());
}

export class ApiErrorService {
  static getMessages(error: unknown, requiresAuth: boolean): string[] {
    if (!axios.isAxiosError<unknown>(error)) {
      return ['Unable to complete the request. Please try again.'];
    }

    if (error.code === 'ERR_CANCELED') {
      return ['The request was canceled.'];
    }

    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return ['The request timed out. Please try again.'];
    }

    const status = error.response?.status;

    if (status === undefined) {
      return ['Unable to connect to the server. Check your connection and try again.'];
    }

    if (status === 401) {
      return [
        requiresAuth
          ? 'Your session is no longer valid. Please sign in again.'
          : 'Invalid email or password.',
      ];
    }

    if (status === 403) {
      return ['You do not have permission to perform this operation.'];
    }

    if (status === 404) {
      return ['The requested resource was not found.'];
    }

    // Never surface a server exception, SQL, stack trace, or raw Axios configuration.
    if (status >= 500) {
      return ['The server is temporarily unavailable. Please try again later.'];
    }

    if (status === 400 || status === 422 || status === 409) {
      return (
        readBackendMessages(error.response?.data, status) ?? [
          status === 409
            ? 'The request conflicts with existing data.'
            : 'Check the submitted data.',
        ]
      );
    }

    return ['Unable to complete the request. Please try again.'];
  }
}
