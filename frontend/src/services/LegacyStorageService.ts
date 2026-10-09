export class LegacyStorageService {
  static clearObsoleteState(): void {
    try {
      // Delete the retired database snapshot without parsing credentials or creating a backup.
      // Repeating this on startup is safe and also cleans data left by older deployments.
      globalThis.localStorage.removeItem('piniaState');
    } catch {
      // Storage can be blocked; API access and memory-only authentication still work.
      console.warn('Unable to remove obsolete browser state.');
    }
  }
}
