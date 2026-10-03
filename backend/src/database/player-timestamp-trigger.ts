// SET NULL ocurre dentro de SQLite: este trigger actualiza también el timestamp.
// No altera el jugador cuando su relación no cambió ni reemplaza reglas del service.
export const playerTimestampTrigger = `
  CREATE TRIGGER IF NOT EXISTS "TRG_players_team_updated_at"
  AFTER UPDATE OF "teamId" ON "players"
  WHEN OLD."teamId" IS NOT NEW."teamId" AND OLD."updatedAt" = NEW."updatedAt"
  BEGIN
    UPDATE "players"
    SET "updatedAt" = strftime('%Y-%m-%d %H:%M:%f', 'now')
    WHERE "id" = NEW."id";
  END
`;
