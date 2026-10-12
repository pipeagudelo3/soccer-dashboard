# Evidencia y reproducción — #56

## Resultado observado

Ejecución: 2026-10-09 UTC, Node 24.19.0 (dentro del rango declarado).
Base del trabajo: PR #72, `b19cf1342dee63fe6b0ac09ee8da8637a43b3abd`.

| Comando                                     | Resultado                                                 |
| ------------------------------------------- | --------------------------------------------------------- |
| `npm ci --prefix frontend`                  | PASS                                                      |
| `npm ci --prefix backend`                   | PASS                                                      |
| `npm run verify --prefix frontend`          | PASS: lint, formato, tipos, 149 pruebas, build            |
| `npm run verify --prefix backend`           | PASS: lint, formato, tipos, 159 unitarias, 324 e2e, build |
| `npm run test:full-stack --prefix frontend` | PASS: 28 escenarios con HTTP y SQLite reales              |
| `npm audit --omit=dev --prefix frontend`    | 0 vulnerabilidades de producción                          |
| `npm audit --omit=dev --prefix backend`     | 0 vulnerabilidades de producción                          |

Los resultados individuales y las horas de la regresión están en `REGRESSION_RESULTS.json`.
La auditoría de producción no afirma que la auditoría completa de dependencias de desarrollo
esté limpia; esa deuda técnica ya se registra por separado.

## Ejecutar la regresión automática

Desde la raíz `soccer-dashboard`, con Node 22.22.3 o una versión compatible de Node 24:

```powershell
npm ci --prefix backend
npm ci --prefix frontend
npm run verify --prefix backend
npm run verify --prefix frontend
npm run test:full-stack --prefix frontend -- --output "$env:TEMP/soccer-regression-evidence"
```

`test:full-stack` necesita el build actual de backend. No incluye las verificaciones individuales
ni se agrega a `verify`, porque requiere ambos proyectos instalados. Usa dependencias existentes,
puertos libres, JWT aleatorio y una SQLite dentro de un directorio temporal. Ejecuta migraciones,
seed explícito dos veces y elimina la base al terminar, también cuando falla. No utiliza la base
local del desarrollador. No ejecuta `seed:clean` ni imprime respuestas, credenciales o tokens.

Si falla, devuelve exit code 1 y el ID de la comprobación. El JSON no imprime datos de dominio.
No registrar como PASS una ejecución con salida parcial o exit code distinto de cero.

El test sustituye únicamente un proxy para estados de retraso, lista vacía y 500. Las pruebas
normales envían solicitudes al proceso real NestJS. El reinicio detiene y crea un nuevo proceso
con el mismo archivo SQLite; un Pinia nuevo simula el estado de una aplicación recargada. Eso
verifica persistencia de proceso, no un reload real del navegador ni un reinicio de Docker.

## Probar en tu navegador con otra base aislada

No usar estos pasos contra una base compartida. Abrir dos terminales independientes.

Terminal A, desde `soccer-dashboard/backend`:

```powershell
$env:NODE_ENV = 'test'
$env:PORT = '3000'
$env:CORS_ORIGIN = 'http://localhost:5173,http://127.0.0.1:5173'
$env:JWT_SECRET = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
$env:JWT_EXPIRES_IN = '15m'
$env:SQLITE_SYNCHRONIZE = 'false'
$env:SQLITE_PATH = Join-Path ([IO.Path]::GetTempPath()) ('soccer-browser-' + [guid]::NewGuid().ToString('N') + '.sqlite')
npm run migration:run
npm run seed
npm run start:prod
```

Terminal B, desde `soccer-dashboard/frontend`:

```powershell
$env:VITE_API_BASE_URL = 'http://localhost:3000/api'
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Abrir `http://127.0.0.1:5173` y DevTools → Console, Network y Application.
No subir `.env.local` ni capturas/HAR que contengan Authorization, contraseñas o respuestas
con información personal. Para este entorno académico aislado, las cuentas ficticias del seed son:

- Administrador: `admin@soccer.example`, contraseña `AdminDemo123`.
- Usuario regular: `user@soccer.example`, contraseña `UserDemo123`.

Seguir B-01–B-18 de la matriz. Las rutas son `/`, `/about`, `/login`, `/dashboard`, `/teams`,
`/players`, `/matches`, `/statistics`, `/team-comparison`, `/admin/users` y `/admin/match-stats`.
Las dos últimas requieren admin; las otras rutas de datos requieren autenticación.
Login es POST `/api/auth/login`; abrir esa URL mediante GET no realiza login.

La política aprobada mantiene el token solo en memoria: después de F5 volver a iniciar sesión.
Los registros de dominio deben seguir iguales. Para probar reinicio del backend, detenerlo con
Ctrl+C en A y ejecutar otra vez `npm run start:prod` en esa misma terminal, conservando el mismo
`SQLITE_PATH`. No volver a ejecutar seed durante esta comprobación.

Al terminar, detener ambos procesos y borrar solo el archivo temporal asignado en A:

```powershell
Remove-Item -LiteralPath $env:SQLITE_PATH -ErrorAction SilentlyContinue
Remove-Item -LiteralPath ($env:SQLITE_PATH + '-wal') -ErrorAction SilentlyContinue
Remove-Item -LiteralPath ($env:SQLITE_PATH + '-shm') -ErrorAction SilentlyContinue
```

Cerrar las terminales descarta las variables locales. No borrar la base habitual de `backend/data`.
Para escenarios vacíos, usar una segunda ruta SQLite temporal, ejecutar migraciones y crear solo
los usuarios de prueba necesarios; conservar la primera base para comparar resultados.

## Límites y criterio de cierre

Este entorno no tiene Docker ni una configuración de contenedores publicada en la base usada.
La descarga del navegador de automatización falló; no se ejecutaron Chart.js ni eventos reales
con un navegador. Los estados visuales, consola, accesibilidad y contenedores quedan pendientes,
con pasos y resultados esperados en la matriz. No se encontró un defecto reproducible en los
casos ejecutados, por lo que no se abrió un issue de defecto.

Cuando exista el despliegue aprobado, ejecutar C-01/C-02 con el volumen SQLite persistente,
sin eliminar volúmenes ni sembrar datos al reiniciar. Registrar comandos reales, imágenes,
commit y resultados; adjuntar evidencia sanitizada al PR o Wiki.

#56 permanece pendiente hasta completar la matriz obligatoria, registrar cualquier defecto
como issue separado y publicar toda la evidencia. El paquete permite avanzar sin cambiar
la arquitectura ni fingir resultados del navegador o contenedores.
