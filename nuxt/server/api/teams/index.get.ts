import { defineEventHandler } from 'h3';
import { TeamCatalogService } from '~~/server/services/TeamCatalogService';

export default defineEventHandler(() => TeamCatalogService.getTeams());
