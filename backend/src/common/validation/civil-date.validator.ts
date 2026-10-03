// Valida fechas civiles exactas, sin aceptar timestamps ni normalizar días imposibles.
// El parámetro now permite probar el límite de hoy sin depender del reloj del test.
export function isPastOrPresentCivilDate(value: unknown, now: Date = new Date()): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value && value <= now.toISOString().slice(0, 10);
}
