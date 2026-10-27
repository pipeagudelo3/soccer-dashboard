import { createError, defineEventHandler, getRouterParam } from 'h3';

import { TeamCatalogService } from '~~/server/services/TeamCatalogService';

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id') ?? '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid team identifier' });
  }

  const team = TeamCatalogService.getTeamById(id);
  if (!team) {
    throw createError({ statusCode: 404, statusMessage: 'Team not found' });
  }
  return team;
});
