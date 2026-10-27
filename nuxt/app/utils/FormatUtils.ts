export class FormatUtils {
  public static formatDate(value: string): string {
    // Civil dates must not move to the previous day in Colombian browsers during hydration.
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'UTC' }).format(
      new Date(`${value}T00:00:00Z`),
    );
  }
}
