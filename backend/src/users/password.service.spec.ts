import { PasswordService } from './password.service.js';

// Verifica el hash real y la comparación que reutilizarán usuarios y autenticación.
describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes a valid password and verifies only the matching value', async () => {
    const passwordHash = await service.hashPassword('FictionalPass123');

    expect(passwordHash).toMatch(/^\$2b\$12\$/);
    expect(passwordHash).not.toBe('FictionalPass123');
    await expect(service.verifyPassword('FictionalPass123', passwordHash)).resolves.toBe(true);
    await expect(service.verifyPassword('WrongPass123', passwordHash)).resolves.toBe(false);
  });

  it.each(['short', 'lowercase123', 'UPPERCASE123', 'NoNumbers', `Aa1${'x'.repeat(70)}`])(
    'rejects a password outside the approved policy',
    async (password) => {
      await expect(service.hashPassword(password)).rejects.toThrow('password policy');
    },
  );
});
