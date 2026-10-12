# Verificación del PR #73 con Node soportado

Fecha: 12 de octubre de 2026 UTC / 11 de octubre de 2026 en Colombia.
Entorno: Linux, Node 24.19.0.

Se reprodujo el merge de `test/full-stack-regression` (`0aab1db`) con `main` (`e994768`), seleccionando los archivos actuales de main para App.vue y package.json, añadiendo el script test:full-stack y el README combinado entregado al desarrollador. Esta comprobación corresponde al árbol integrado reproducido; no afirma que el merge estuviera publicado en GitHub ni que las pruebas se ejecutaran en el equipo Windows del desarrollador.

| Comprobación | Resultado |
| --- | --- |
| npm ci --prefix frontend | Código 0 |
| npm ci --prefix backend | Código 0 |
| npm run verify --prefix frontend | Código 0; 149 pruebas, lint, formato, tipos y build correctos |
| npm run verify --prefix backend | Código 0; 159 unitarias, 324 e2e, lint, formato, tipos y build correctos |
| npm run test:full-stack --prefix frontend | Código 0; 28 casos correctos |
| npm audit --prefix frontend | Código 0; cero vulnerabilidades |
| npm audit --omit=dev --prefix frontend | Código 0; cero vulnerabilidades |
| npm audit --omit=dev --prefix backend | Código 0; cero vulnerabilidades |
| git diff --check | Código 0 |

La regresión usa migraciones y seed explícito sobre SQLite temporal aislada, servicios/composables reales mediante Vite SSR, Axios y la API NestJS real. Comprueba también persistencia tras reiniciar un proceso backend. Los escenarios de retraso, listas vacías y error 500 se inyectan explícitamente.

No se repitió la auditoría completa de desarrollo del backend como parte de esta ejecución. La auditoría de producción no mide esas dependencias.

Pendientes del #56: interacción y renderizado en navegador real, consola y gráficos; reinicio real de contenedores con volumen SQLite persistente. El reinicio del proceso backend probado no equivale al reinicio de contenedores.
