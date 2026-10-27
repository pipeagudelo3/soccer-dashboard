import type { TeamInterface } from '#shared/interfaces/TeamInterface';

// These fixtures belong exclusively to Nitro and are never imported by the application layer.
export const teams: readonly TeamInterface[] = [
  {
    country: 'Colombia',
    foundedDate: '1986-04-12',
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Andes FC',
    stadium: 'Estadio de la Montaña',
  },
  {
    country: 'Brasil',
    foundedDate: '1978-09-07',
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Rio Stars',
    stadium: 'Arena del Sol',
  },
  {
    country: 'Argentina',
    foundedDate: '1992-03-21',
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Sur Atlético',
    stadium: 'Estadio del Sur',
  },
  {
    country: 'Uruguay',
    foundedDate: '1965-11-15',
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Costa United',
    stadium: 'Parque del Puerto',
  },
];
