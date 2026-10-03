# Backend de Soccer Dashboard — issues #40 y #41

Backend NestJS con TypeScript estricto, ESLint, Prettier, Jest, TypeORM y SQLite (`better-sqlite3`). Conserva la estructura por módulos del ejemplo, con nombres propios de Soccer Dashboard. User, Team, Player y MatchStats son las únicas entidades de dominio.

## 1. Requisitos y configuración local

Usa Node `^22.22.3` o `^24.15.0`. Cada aplicación mantiene su propio package.json y package-lock.json. No necesitas Nest CLI global.

Desde `soccer-dashboard/backend`:

```bash
# Instala exactamente las versiones del lockfile actualizado.
npm ci

# Solo en una instalación nueva: crea .env si todavía no tienes uno.
node -e "require('node:fs').copyFileSync('.env.example', '.env')"

# Solo si necesitas configurar JWT_SECRET: genera un valor y pégalo en .env.
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"

# En desarrollo, abre SQLite y crea el esquema antes de escuchar HTTP.
npm run start:dev
```

Si ya configuraste `.env` en #40, consérvalo y agrega `SQLITE_SYNCHRONIZE=true` para el entorno académico/local. No sobrescribas tu secreto. Las variables del proceso tienen prioridad; los archivos se leen en orden `.env.local`, `.env`. Tests ignoran ambos archivos personales.

| Variable           | Finalidad                                      | Condición/default                                    |
| ------------------ | ---------------------------------------------- | ---------------------------------------------------- |
| NODE_ENV           | development, test o production                 | development                                          |
| PORT               | Puerto entero 1–65535                          | 3000                                                 |
| CORS_ORIGIN        | Orígenes exactos HTTP/HTTPS separados por coma | localhost/127.0.0.1 en 5173; explícito en producción |
| JWT_SECRET         | Secreto, al menos 32 bytes                     | Obligatorio y externo a Git                          |
| JWT_EXPIRES_IN     | Duración JWT preparada para #47                | 15m                                                  |
| SQLITE_PATH        | Archivo SQLite                                 | ./data/database.sqlite                               |
| SQLITE_SYNCHRONIZE | Sincronización automática académica/local      | true en desarrollo/test; false en producción         |

SQLite resuelve rutas relativas desde el directorio donde arrancas el backend. El directorio padre se crea automáticamente y se comprueba acceso. `:memory:` se permite solo en tests. El arranque falla si SQLite no puede abrir la ubicación; no sustituye el archivo por una base efímera.

## 2. Disponibilidad y archivos locales

`GET http://localhost:3000/api/health` devuelve HTTP 200 y `{ "status": "ok" }`. La conexión SQLite se inicializa antes de abrir el puerto. Health sigue siendo una comprobación simple del proceso; no ejecuta una consulta de disponibilidad en cada petición.

La ruta local habitual es `backend/data/database.sqlite`. No se versionan `.env`, bases, node_modules, dist ni cobertura. El backend no inserta fixtures en el arranque: los seeders corresponden al issue #42.

## 3. Entidades y contratos

| Entidad    | Campos persistidos propios                                                       |
| ---------- | -------------------------------------------------------------------------------- |
| User       | name, email, role y passwordHash                                                 |
| Team       | name, logoURL, country, stadium y foundedDate                                    |
| Player     | name, position, status, teamId nullable, goals y assists                         |
| MatchStats | date, homeTeamId, awayTeamId, goalsHomeTeam, goalsAwayTeam, stadium y attendance |

Todas heredan UUID, createdAt y updatedAt de `BaseEntity`, una clase abstracta que no crea tabla adicional. UUID se genera al insertar mediante TypeORM; sigue siendo string en el contrato público. Fechas civiles usan YYYY-MM-DD; TypeORM utiliza Date para timestamps y JSON los publica en UTC ISO 8601.

Las relaciones de navegación ORM (`team`, `players`, `homeMatches`, `homeTeam`, etc.) no se agregan al contrato público normalizado. Los próximos controllers deben mapear sus respuestas a DTOs, sin publicar entidades completas con relaciones embebidas.

### Contraseñas

`PasswordService` genera hashes bcrypt con coste 12 y compara valores sin recuperarlos. No hay una columna password. Se aplica la política del contrato: mínimo 8 caracteres, mayúscula, minúscula, número y máximo 72 bytes UTF-8.

`passwordHash` tiene `select: false`, por lo que no aparece en consultas ordinarias. `User.toJSON()` usa una lista explícita de campos seguros y omite el hash incluso cuando autenticación lo seleccione expresamente. Un CHECK impide almacenar texto plano en esa columna; su formato no reemplaza el uso obligatorio de PasswordService.

No construyas una respuesta copiando con spread una entidad cargada con hash ni devuelvas resultados SQL crudos. Usa el DTO público/mapper. Login y CRUD no se implementan en #41.

## 4. Restricciones y eliminación

- Email y nombre de equipo tienen índice único con collation SQLite NOCASE (comparación case-insensitive ASCII). User normaliza email al guardar; Team recorta campos. Las validaciones completas de DTOs y reglas de formato/calendario llegan en los módulos REST.
- Player.teamId es FK nullable; un UUID inexistente produce error de integridad.
- MatchStats exige equipos existentes y diferentes, con FK obligatorias.
- La combinación `(date, homeTeamId, awayTeamId)` no se puede duplicar.
- Las estadísticas deben ser enteros no negativos dentro del rango seguro de JavaScript. Los CHECK rechazan también decimales.
- Roles y estados del jugador se restringen a los valores aprobados.
- Team con partidos no puede eliminarse: las dos FK de MatchStats usan RESTRICT.
- Team sin partidos puede eliminarse: SQLite usa SET NULL para los jugadores, conservando sus datos. Un trigger actualiza updatedAt cuando cambia teamId por esta operación.
- Eliminar Player o MatchStats conserva sus equipos; no hay cascadas de borrado.

El service Teams de #44 ejecutará la operación y las comprobaciones en una transacción y traducirá conflictos a 409. La protección del último administrador, las autorizaciones y los errores HTTP de dominio corresponden a #43/#47/#48; no están implementados por este issue.

## 5. synchronize y migraciones

En el alcance académico/local se permite `SQLITE_SYNCHRONIZE=true`: TypeORM crea/ajusta el esquema desde las entidades. No es una estrategia de migraciones de producción y no garantiza conservar datos ante cambios de estructura. Para datos que deban conservarse usa migraciones versionadas.

Producción rechaza explícitamente synchronize=true. Define en el entorno o archivo local:

```dotenv
# Configuración de producción; el secreto se suministra externamente.
NODE_ENV=production
SQLITE_SYNCHRONIZE=false
SQLITE_PATH=/data/database.sqlite
CORS_ORIGIN=https://tu-dominio.example
```

El secreto JWT existente sigue siendo obligatorio. Antes de iniciar una base de producción vacía, crea su esquema mediante la migración inicial:

```bash
# Compila y ejecuta las migraciones pendientes; no sincroniza ni reintroduce datos.
npm run migration:run

# Comprueba cuáles migraciones ya están registradas.
npm run migration:show

# Arranca el código compilado con el esquema preparado.
npm run start:prod
```

El CLI usa el mismo registro de entidades y carga `.env` y después `.env.local` con los flags nativos de Node. Conserva la prioridad de las variables del proceso. Su DataSource fuerza synchronize=false incluso si el ejemplo local contiene true. La migración inicial sirve para una base vacía y crea tablas, índices, checks, FK y trigger. Ejecutarla de nuevo no duplica el esquema.

No ejecutes esa migración inicial sobre una base que ya creaste mediante synchronize: contiene las mismas tablas pero no su registro de migración. Mantén el modo local o prepara una base nueva en otra ruta; para conservar datos requiere una adopción/migración revisada, no un borrado automático. Futuras modificaciones de esquema deben tener su propia migración. Revertir la migración inicial elimina las tablas y sus datos.

## 6. Ruta persistente compatible con Docker

El valor previsto para despliegue es `SQLITE_PATH=/data/database.sqlite`. La aplicación crea el directorio dentro del volumen si el usuario del contenedor tiene permisos de escritura. El Compose completo y los Dockerfiles corresponden a #57; este es el fragmento de almacenamiento que deberá integrarse allí:

```yaml
services:
  backend:
    environment:
      # Mantiene el esquema bajo control de migraciones y guarda SQLite en el volumen.
      SQLITE_PATH: /data/database.sqlite
      SQLITE_SYNCHRONIZE: 'false'
    volumes:
      # El mismo volumen contiene SQLite y cualquier archivo auxiliar del driver.
      - soccer_dashboard_data:/data

volumes:
  # Conserva datos al recrear contenedores; down -v elimina este volumen.
  soccer_dashboard_data:
```

El fragmento no constituye un Compose ejecutable: #57 añadirá imagen, puertos, secretos y demás configuración. No se agrega una imagen ni un servicio de base separado para SQLite.

## 7. Calidad y pruebas

```bash
# Aplica formato antes de verificar los cambios.
npm run format

# Verifica lint, formato, tipos, unitarias, e2e y compilación.
npm run verify
```

Se conservan los scripts de #40 (start/dev/debug/prod, build, type-check, lint/lint:fix, format/format:check, test/test:watch/test:cov y test:e2e). Jest usa ESM con experimental-vm-modules, compatible con NestJS 12; el build usa NodeNext e imports .js.

Las pruebas de base usan :memory: o archivos temporales aislados y eliminan solo sus directorios temporales. Cubren relaciones, UUID, timestamps, unicidad, CHECK, protección de hashes, eliminación, migración inicial y persistencia tras reabrir. No leen una base local del proyecto ni una base desplegada.

La cobertura unitaria publicada incluye los archivos declarados en jest.config.cjs, no todo el repositorio; los escenarios de integridad se verifican adicionalmente en e2e. No interpretes ese porcentaje como cobertura completa del backend.

## 8. Organización de archivos

| Ruta                                           | Responsabilidad                                        |
| ---------------------------------------------- | ------------------------------------------------------ |
| src/database/database.module.ts                | Registrar la conexión asíncrona con Nest               |
| src/database/database-options.ts               | Resolver archivo y definir driver, entidades y pragmas |
| src/database/initialize-database.ts            | Inicializar conexión y trigger local/test              |
| src/database/entities/base.entity.ts           | UUID y timestamps compartidos                          |
| src/database/entity-registry.ts                | Registrar las cuatro entidades                         |
| src/database/data-source.ts                    | DataSource usado por CLI de migraciones                |
| src/database/migration-registry.ts             | Lista de migraciones versionadas                       |
| src/database/migrations/                       | Esquema inicial mediante up/down                       |
| src/database/player-timestamp-trigger.ts       | Timestamp al desvincular jugadores                     |
| src/users/entities/user.entity.ts              | Usuario, hash oculto y serialización segura            |
| src/users/dto/user-response.dto.ts             | Contrato público sin credenciales                      |
| src/users/password.service.ts                  | Hash y comparación bcrypt                              |
| src/teams/entities/team.entity.ts              | Equipo y relaciones inversas                           |
| src/players/entities/player.entity.ts          | Jugador y FK opcional                                  |
| src/match-stats/entities/match-stats.entity.ts | Partido y referencias obligatorias                     |
| src/_/_.module.ts                              | Repositorios TypeORM disponibles para futuros services |
| test/database.e2e-spec.ts                      | Integridad, persistencia y migraciones reales          |

Los archivos fuente tienen comentarios explicativos por bloque. JSON no admite comentarios: tsconfig configura el compilador, nest-cli.json configura el build Nest, package.json declara scripts/dependencias y .prettierrc.json contiene el formato compartido. El lockfile lo genera npm.

No se modifica el frontend. La integración de Vue con estos datos corresponde a #50–#55. Usa la rama feature/backend-database-entities y registra en el PR solo las verificaciones que realmente ejecutaste.
