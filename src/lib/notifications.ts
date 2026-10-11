export type NoticeKind = 'error' | 'success' | 'info';
export type Notice = { message: string; kind: NoticeKind };

export function notify(message: string, kind: NoticeKind = 'error') {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<Notice>('3digit:notice', { detail: { message, kind } }));
}

export function errorMessage(error: unknown) {
  if (error instanceof Error && error.name === 'ApiError' && error.message) return error.message;
  if (error && typeof error === 'object' && 'code' in error) return 'The club could not load or save that information. Please try again.';
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}
