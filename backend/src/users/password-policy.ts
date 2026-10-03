// Comparte la misma política entre DTOs, usuarios y seed sin modificar el password.
export function isValidPassword(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 8 &&
    Buffer.byteLength(value, 'utf8') <= 72 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /[0-9]/.test(value)
  );
}
