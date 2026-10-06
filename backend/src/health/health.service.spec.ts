import { HealthService } from './health.service.js';

// Comprueba el contrato público exacto del único servicio incluido en este scaffold.
describe('HealthService', () => {
  it('returns only the public availability status', () => {
    const service = new HealthService();

    expect(service.getStatus()).toEqual({ status: 'ok' });
  });
});
