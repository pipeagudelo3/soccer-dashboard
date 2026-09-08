/**
 * Generates a reasonably unique identifier for a new domain entity.
 * LocalStorage is the persistence layer for this project stage, so ids are
 * created on the client instead of being assigned by a backend.
 */
export function generateId(prefix: string): string {
  const randomSegment = Math.random().toString(36).slice(2, 10);
  const timeSegment = Date.now().toString(36);

  return `${prefix}-${timeSegment}-${randomSegment}`;
}
