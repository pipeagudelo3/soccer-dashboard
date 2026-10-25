export class PointsUtils {
  public static calculatePoints(wins: number, draws: number): number | undefined {
    if (![wins, draws].every((value) => Number.isSafeInteger(value) && value >= 0)) {
      return undefined;
    }
    const points = wins * 3 + draws;
    return Number.isSafeInteger(points) ? points : undefined;
  }
}
