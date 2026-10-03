import { isPastOrPresentCivilDate } from './civil-date.validator.js';

// Usa un día UTC fijo para comprobar años bisiestos, formato exacto y el límite futuro.
describe('isPastOrPresentCivilDate', () => {
  const now = new Date('2026-10-03T00:30:00.000Z');

  it.each(['2026-10-03', '2026-10-02', '2024-02-29', '2000-02-29', '0001-01-01'])(
    'accepts real past or present dates: %s',
    (value) => {
      expect(isPastOrPresentCivilDate(value, now)).toBe(true);
    },
  );

  it.each([
    '2026-10-04',
    '9999-01-01',
    '2025-02-29',
    '1900-02-29',
    '2025-04-31',
    '2025-13-01',
    '2025-00-01',
    '2025-01-00',
    '0000-01-01',
    '2025-1-01',
    '2025-01-01T00:00:00Z',
    ' 2025-01-01 ',
    '',
    null,
    20250101,
  ])('rejects invalid dates: %s', (value) => {
    expect(isPastOrPresentCivilDate(value, now)).toBe(false);
  });
});
