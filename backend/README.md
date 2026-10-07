# Backend de Soccer Dashboard — issues #40–#47

Backend NestJS con TypeScript estricto, ESLint, Prettier, Jest, TypeORM y SQLite (`better-sqlite3`). Conserva la estructura por módulos del ejemplo, con nombres propios de Soccer Dashboard. User, Team, Player y MatchStats son las únicas entidades de dominio.

## 1. Requisitos y configuración local

Usa Node `^22.22.3` o `^24.15.0`. Cada aplicación mantiene su propio package.json y package-lock.json. No necesitas Nest CLI global.

Desde `soccer-dashboard/backend`:

```bash
# Instala exactamente las versiones del lockfile actualizado.
npm ci

# Solo en una instalación nueva: crea .env si todavía no tienes uno.
node -e "require('node:fs').copyFileSync('.env.example', '.env')"

# Obligatorio antes de iniciar: genera JWT_SECRET y pega el valor en .env.
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"

# En desarrollo, abre SQLite y crea el esquema antes de escuchar HTTP.
npm run start:dev
```

`JWT_SECRET` no tiene valor por defecto: debes configurarlo con al menos 32 bytes antes de iniciar el servidor o ejecutar migraciones y seed. No lo publiques ni uses las contraseñas de demo como secreto.

Si ya configuraste `.env` en #40, consérvalo y agrega `SQLITE_SYNCHRONIZE=true` para el entorno académico/local. No sobrescribas tu secreto. Las variables del proceso tienen prioridad; los archivos se leen en orden `.env.local`, `.env`. Tests ignoran ambos archivos personales.

| Variable           | Finalidad                                      | Condición/default                                    |
| ------------------ | ---------------------------------------------- | ---------------------------------------------------- |
| NODE_ENV           | development, test o production                 | development                                          |
| PORT               | Puerto entero 1–65535                          | 3000                                                 |
| CORS_ORIGIN        | Orígenes exactos HTTP/HTTPS separados por coma | localhost/127.0.0.1 en 5173; explícito en producción |
| JWT_SECRET         | Secreto, al menos 32 bytes                     | Obligatorio y externo a Git                          |
| JWT_EXPIRES_IN     | Duración de access token, 1s–1h                | 15m                                                  |
| SQLITE_PATH        | Archivo SQLite                                 | ./data/database.sqlite                               |
| SQLITE_SYNCHRONIZE | Sincronización automática académica/local      | true en desarrollo/test; false en producción         |

SQLite resuelve rutas relativas desde el directorio donde arrancas el backend. El directorio padre se crea automáticamente y se comprueba acceso. `:memory:` se permite solo en tests. El arranque falla si SQLite no puede abrir la ubicación; no sustituye el archivo por una base efímera.

## 2. Disponibilidad y archivos locales

`GET http://localhost:3000/api/health` devuelve HTTP 200 y `{ "status": "ok" }`. La conexión SQLite se inicializa antes de abrir el puerto. Health sigue siendo una comprobación simple del proceso; no ejecuta una consulta de disponibilidad en cada petición.

La ruta local habitual es `backend/data/database.sqlite`. No se versionan `.env`, bases, node_modules, dist ni cobertura. El backend no ejecuta el seed durante el arranque: se ejecuta mediante un comando explícito.

## 3. Entidades y contratos

| Entidad    | Campos persistidos propios                                                       |
| ---------- | -------------------------------------------------------------------------------- |
| User       | name, email, role y passwordHash                                                 |
| Team       | name, logoURL, country, stadium y foundedDate                                    |
| Player     | name, position, status, teamId nullable, goals y assists                         |
| MatchStats | date, homeTeamId, awayTeamId, goalsHomeTeam, goalsAwayTeam, stadium y attendance |

Todas heredan UUID, createdAt y updatedAt de `BaseEntity`, una clase abstracta que no crea tabla adicional. UUID se genera al insertar mediante TypeORM; sigue siendo string en el contrato público. Fechas civiles usan YYYY-MM-DD; TypeORM utiliza Date para timestamps y JSON los publica en UTC ISO 8601.

Las relaciones de navegación ORM (`team`, `players`, `homeMatches`, `homeTeam`, etc.) no se agregan al contrato público normalizado. Los controllers de los cuatro módulos delegan en sus servicios y publican DTOs mediante mappers, sin relaciones embebidas ni hashes. Los cuatro módulos de dominio ya implementan CRUD.

### Contraseñas

`PasswordService` genera hashes bcrypt con coste 12 y compara valores sin recuperarlos. No hay una columna password. Se aplica la política del contrato: mínimo 8 caracteres, mayúscula, minúscula, número y máximo 72 bytes UTF-8.

`passwordHash` tiene `select: false`, por lo que no aparece en consultas ordinarias. `User.toJSON()` usa una lista explícita de campos seguros y omite el hash incluso cuando autenticación lo seleccione expresamente. Un CHECK impide almacenar texto plano en esa columna; su formato no reemplaza el uso obligatorio de PasswordService.

No construyas una respuesta copiando con spread una entidad cargada con hash ni devuelvas resultados SQL crudos. Usa el DTO público/mapper. El CRUD de Users está implementado en #43; el login y `/api/auth/me` están implementados en #47.

## 4. Restricciones y eliminación

- Email y nombre de equipo tienen índice único con collation SQLite NOCASE (comparación case-insensitive ASCII). User normaliza email al guardar; Team recorta campos. Users y Teams ya validan DTOs; Teams comprueba URLs y fechas civiles reales que no sean futuras.
- Player.teamId es FK nullable; un UUID inexistente produce error de integridad.
- MatchStats exige equipos existentes y diferentes, con FK obligatorias.
- La combinación `(date, homeTeamId, awayTeamId)` no se puede duplicar.
- Las estadísticas deben ser enteros no negativos dentro del rango seguro de JavaScript. Los CHECK rechazan también decimales.
- Roles y estados del jugador se restringen a los valores aprobados.
- Team con partidos no puede eliminarse: las dos FK de MatchStats usan RESTRICT.
- Team sin partidos puede eliminarse: SQLite usa SET NULL para los jugadores, conservando sus datos. Un trigger actualiza updatedAt cuando cambia teamId por esta operación.
- Eliminar Player o MatchStats conserva sus equipos; no hay cascadas de borrado.

TeamsService comprueba partidos como local o visitante y bloquea la eliminación con 409 antes de modificar jugadores. Cuando está permitida, desvincula jugadores y elimina el equipo en una misma transacción; un fallo revierte ambos cambios. UsersService impide borrar o degradar al último administrador. Las escrituras comparten una cola para coordinar transacciones SQLite. Los guards consultan el usuario y su rol actual en la base, y los errores HTTP tienen un formato consistente.

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
| src/users/users.module.ts                      | Registro del módulo y repositorio de usuarios          |
| src/users/users.controller.ts                  | Endpoints administrativos de usuarios                  |
| src/users/users.service.ts                     | Unicidad, hashes y protección del último administrador |
| src/teams/teams.module.ts                      | Registro del módulo y repositorio de equipos           |
| src/teams/teams.controller.ts                  | Lecturas autenticadas y mutaciones administrativas     |
| src/teams/teams.service.ts                     | Validación de dominio y eliminación transaccional      |
| src/players/players.module.ts                  | Registro del módulo CRUD y repositorio de jugadores    |
| src/match-stats/match-stats.module.ts          | Registro del módulo CRUD y repositorio de partidos     |
| src/auth/guards/                               | Verificación JWT y autorización administrativa         |
| src/common/filters/                            | Respuestas de error y diagnóstico seguro de fallos 5xx |
| src/seed/                                      | Comandos y datos ficticios idempotentes                |
| src/database/database-write.service.ts         | Coordinación de escrituras SQLite                      |
| test/database.e2e-spec.ts                      | Integridad, persistencia y migraciones reales          |

Los archivos fuente tienen comentarios explicativos por bloque. JSON no admite comentarios: tsconfig configura el compilador, nest-cli.json configura el build Nest, package.json declara scripts/dependencias y .prettierrc.json contiene el formato compartido. El lockfile lo genera npm.

No se modifica el frontend. La integración de Vue con estos datos corresponde a #50–#55. La rama `feature/backend-foundation` (PR #62) contiene #40–#44; `feature/backend-jwt-auth` (PR #63) añade conjuntamente Players (#45), MatchStats (#46) y JWT (#47).

El PR #62 fue fusionado en main mediante el commit a5a5492. Esta rama incorpora esa base y conserva Players (#45), MatchStats (#46), JWT (#47) y sus ajustes asociados. Antes de publicar la actualización del PR #63, se revisará el diff contra main y se ejecutará nuevamente npm run verify.

El contrato de arquitectura del issue #39 requiere que el equipo registre expresamente su aprobación o decisión antes de integrar los módulos dependientes. Este README describe el comportamiento implementado y no representa esa aprobación. Las descripciones de cada PR deben registrar únicamente verificaciones efectivamente ejecutadas y sus referencias de cierre.

## 9. Seed académico e idempotencia

Desde `backend/`, con tu `JWT_SECRET` ya configurado:

```bash
# Compila y agrega únicamente los registros ficticios que faltan en SQLITE_PATH.
npm run seed

# Crea y llena otro archivo local sin borrar la base actual.
npm run seed:clean
```

El seed crea 4 equipos, 8 jugadores, 4 partidos, un administrador y un usuario regular. Usa UUID estables y comprobaciones de existencia dentro de una transacción. Repetirlo no duplica registros ni reemplaza nombres, roles, contraseñas o estadísticas existentes; tampoco reinicia datos al recargar el servidor. Las relaciones usan equipos existentes y diferentes para cada partido.

| Rol             | Correo ficticio      | Contraseña académica |
| --------------- | -------------------- | -------------------- |
| Administrador   | admin@soccer.example | AdminDemo123         |
| Usuario regular | user@soccer.example  | UserDemo123          |

Estas credenciales son públicas y exclusivamente de evaluación local. Los passwords se guardan como hashes con el mismo PasswordService de Users. Ambos comandos rechazan producción. Ambas cuentas pueden autenticarse mediante POST `/api/auth/login`. Si ya modificaste una contraseña o email, el seed preserva esos cambios y debes utilizar tus credenciales actuales.

`seed:clean` imprime `SQLITE_PATH=.../database.clean-<uuid>.sqlite`. Copia esa ruta en `SQLITE_PATH` de tu `.env` (o `.env.local` si lo utilizas) y reinicia el backend para usarla. El comando no modifica esos archivos. Comprueba que una variable del proceso no esté prevaleciendo sobre la ruta elegida. La base original se conserva. Para trabajar con migraciones en lugar de sincronización, usa otra base vacía, ejecuta `npm run migration:run` y después `npm run seed`.

## 10. API implementada y autorización

Todos los identificadores de las rutas de dominio son UUID v4. Un ID mal formado devuelve 400; uno válido inexistente devuelve 404. Las listas devuelven arrays completos, sin paginación.

| Método | Ruta                 | Acceso              | Éxito          |
| ------ | -------------------- | ------------------- | -------------- |
| GET    | /api/health          | Público             | 200            |
| POST   | /api/auth/login      | Público             | 200            |
| GET    | /api/auth/me         | Usuario autenticado | 200            |
| GET    | /api/users           | Administrador       | 200            |
| GET    | /api/users/:id       | Administrador       | 200            |
| POST   | /api/users           | Administrador       | 201            |
| PATCH  | /api/users/:id       | Administrador       | 200            |
| DELETE | /api/users/:id       | Administrador       | 204 sin cuerpo |
| GET    | /api/teams           | Usuario autenticado | 200            |
| GET    | /api/teams/:id       | Usuario autenticado | 200            |
| POST   | /api/teams           | Administrador       | 201            |
| PATCH  | /api/teams/:id       | Administrador       | 200            |
| DELETE | /api/teams/:id       | Administrador       | 204 sin cuerpo |
| GET    | /api/players         | Usuario autenticado | 200            |
| GET    | /api/players/:id     | Usuario autenticado | 200            |
| POST   | /api/players         | Administrador       | 201            |
| PATCH  | /api/players/:id     | Administrador       | 200            |
| DELETE | /api/players/:id     | Administrador       | 204 sin cuerpo |
| GET    | /api/match-stats     | Usuario autenticado | 200            |
| GET    | /api/match-stats/:id | Usuario autenticado | 200            |
| POST   | /api/match-stats     | Administrador       | 201            |
| PATCH  | /api/match-stats/:id | Administrador       | 200            |
| DELETE | /api/match-stats/:id | Administrador       | 204 sin cuerpo |

Envía `Authorization: Bearer <JWT>` en las rutas protegidas. El JWT debe estar firmado con el secreto configurado e identificar un usuario existente mediante `sub`. Sin token válido se devuelve 401; un usuario sin permiso administrativo recibe 403. POST `/api/auth/login` emite los tokens y GET `/api/auth/me` devuelve el perfil vigente. El frontend todavía no consume esta API.

Users normaliza el email, valida nombre, contraseña y roles `admin`/`user`, rechaza emails duplicados con 409 y nunca devuelve hashes. La autoedición está permitida si respeta la protección del último administrador. Después de degradarse, el usuario pierde acceso administrativo en la siguiente petición; después de autoeliminarse, su token recibe 401 porque la cuenta ya no existe.

Teams recorta texto, valida nombre, país, estadio, logoURL y foundedDate, y rechaza nombres duplicados con 409. Las eliminaciones respetan las reglas transaccionales descritas arriba. Los DTOs rechazan campos adicionales; las relaciones se representan con IDs, sin objetos Team embebidos.

## 11. Errores y diagnóstico interno

Las respuestas usan `{ statusCode, message: string[], path, timestamp }`. Los fallos inesperados devuelven un mensaje genérico; 503 utiliza un mensaje de indisponibilidad. Nest mantiene habilitados los niveles `error`, `warn` y `log`.

ApiExceptionFilter registra cada fallo 5xx como `http_server_error` con su estado, una categoría conocida de excepción, un código SQLite de una lista permitida cuando existe y hasta cinco ubicaciones relativas del código obtenidas del stack original. No entrega al logger la excepción completa, su mensaje, SQL, parámetros, cuerpos, headers, tokens, query string ni rutas absolutas. Los errores 4xx esperados no generan ese registro. Las pruebas comprueban que los datos privados no aparecen en el diagnóstico ni en la respuesta 5xx.

## 12. Players REST — #45

El módulo Players conserva exactamente las nueve propiedades públicas de PlayerInterface: `id`, `name`, `position`, `status`, `teamId`, `goals`, `assists`, `createdAt` y `updatedAt`. El mapper excluye objetos Team cargados por TypeORM y devuelve timestamps ISO UTC. Las lecturas usan la misma política de sesión JWT que Teams; las mutaciones exigen administrador y revalidan al actor dentro de la transacción.

POST requiere los seis campos editables. `name` y `position` se recortan; `status` se recorta y se restringe a `active`, `injured`, `suspended` o `free-agent`. No se convierte texto a números: `goals` y `assists` deben ser enteros finitos entre cero y Number.MAX_SAFE_INTEGER, coherentes con las restricciones SQLite. `teamId` debe ser null explícito o UUID v4 de un equipo existente; un equipo inexistente se rechaza con 400. No se aceptan objetos Team embebidos, IDs ni timestamps proporcionados por el cliente.

PATCH requiere al menos un campo editable. Omitir un campo conserva su valor; `teamId: null` desvincula el equipo. El resto de los campos no admite null. Asignar o quitar un equipo no modifica automáticamente el estado ni las estadísticas del jugador. Se valida el registro resultante y la relación antes de persistir. Las escrituras comparten la cola de DatabaseWriteService con Users y Teams, y las FK siguen activas para proteger cambios desde otras conexiones.

Los UUID válidos de jugadores inexistentes devuelven 404; IDs mal formados devuelven 400. DELETE devuelve 204 sin cuerpo y conserva el equipo. Cuando Teams elimina un equipo permitido, GET de Players refleja `teamId: null` conservando las otras propiedades. Los errores usan el mismo envelope seguro de toda la API.

Las pruebas del módulo cubren JWT y roles, las nueve propiedades, normalización, estados, números inválidos, equipos inexistentes, relaciones null, PATCH sin cambios parciales, eliminación, coordinación con Teams y rollback real ante un fallo SQLite. El seed existente sigue funcionando; no se añade una migración porque #45 no cambia el esquema.

## 13. MatchStats REST — #46

El módulo publica las diez propiedades normalizadas de MatchStatsInterface: `id`, `date`, `homeTeamId`, `awayTeamId`, `goalsHomeTeam`, `goalsAwayTeam`, `stadium`, `attendance`, `createdAt` y `updatedAt`. Las respuestas excluyen objetos y nombres de equipos; esos nombres se resuelven para la presentación. Las lecturas requieren JWT y las escrituras requieren administrador, revalidado en la transacción.

POST exige los siete campos editables. `date` se recorta y debe ser una fecha civil real YYYY-MM-DD, anterior o igual al día UTC actual. `stadium` se recorta y no puede quedar vacío. Los goles y asistencia deben ser enteros finitos entre cero y Number.MAX_SAFE_INTEGER, sin convertir strings a números. Ambos IDs deben ser UUID v4 de equipos existentes y diferentes. No se aceptan relaciones embebidas ni IDs o timestamps asignados por el cliente.

PATCH requiere al menos un campo editable: los omitidos conservan sus valores y ninguno admite null. Se valida el partido resultante completo antes de escribir. La combinación exacta de fecha, local y visitante no se puede duplicar; al editar se excluye el registro actual. Cambiar marcadores o estadio no evita el conflicto 409. Invertir local/visitante o cambiar la fecha constituye una combinación diferente.

IDs mal formados, campos inválidos, equipos inexistentes o iguales devuelven 400; un UUID válido de partido inexistente devuelve 404. DELETE devuelve 204 sin cuerpo y conserva los equipos. TeamsService consulta ambas FK para impedir eliminar equipos referenciados con 409; al eliminar el último partido que referencia un equipo, esa protección deja de bloquearlo. El índice único y las FK de SQLite siguen siendo defensa final para otras conexiones.

Las escrituras comparten DatabaseWriteService con los demás módulos. Las pruebas cubren duplicados simultáneos y creación concurrente con eliminación de equipo, sin relaciones huérfanas, además de rollback real si falla una actualización. El error inesperado mantiene el mensaje genérico y se registra mediante el filtro seguro.

Las validaciones de enteros y calendario se reutilizan con Players y Teams. No se cambia el esquema ni se requiere una migración nueva. Login y emisión de JWT están implementados en #47; la conexión HTTP del frontend sigue pendiente de los requisitos de integración.

## 14. JWT y autorización por roles — #47

POST `/api/auth/login` recibe `{ email, password }`. El email se recorta y pasa a minúsculas; la contraseña se compara sin recortarla mediante PasswordService/bcrypt. Una estructura inválida devuelve 400. Email inexistente y contraseña incorrecta devuelven el mismo 401 con `Invalid email or password.`; el caso de email inexistente también ejecuta bcrypt contra un hash temporal de coste 12. Entradas de más de 72 bytes UTF-8 se rechazan con 401 para evitar truncamiento bcrypt.

El éxito devuelve HTTP 200 y `{ accessToken, tokenType: 'Bearer', expiresIn, user }`, donde expiresIn es la duración en segundos y user solo contiene `id`, `name`, `email`, `role`, `createdAt` y `updatedAt`. No devuelve passwords, hashes ni JWT_SECRET. La respuesta tiene `Cache-Control: no-store`.

JWT_SECRET se obtiene de la configuración validada, sin default y con mínimo 32 bytes. JWT_EXPIRES_IN acepta segundos, minutos u horas entre 1s y 1h; su default es 15m. Se firma y verifica exclusivamente HS256. El token contiene sub (UUID v4), iat y exp; no contiene el rol ni el perfil. JwtStrategy utiliza JwtService existente, sin incorporar Passport u otra dependencia. JwtAuthGuard acepta Bearer exclusivamente en Authorization, no en query strings ni cuerpos.

La estrategia obtiene al usuario actual en SQLite para cada petición. Una cuenta eliminada recibe 401 con su token anterior; un cambio de rol se aplica inmediatamente. GET `/api/auth/me` admite cualquier usuario autenticado y devuelve su perfil vigente, sin token ni hash, también con `Cache-Control: no-store`. RolesGuard utiliza el decorador Roles en clases o métodos; los métodos pueden especificar una política distinta a la clase. Todos los CRUD exigen admin en las mutaciones; Users también exige admin en las lecturas. Las transacciones revalidan al actor después de esperar la cola de escrituras. AdminGuard se conserva como adaptador restrictivo de compatibilidad que delega en RolesGuard.

El modelo aprobado User no tiene un campo enabled/disabled. Por ello no existe una operación de deshabilitación ni se simula ese estado: eliminar una cuenta revoca su acceso. Incorporar deshabilitación requerirá aprobar el cambio del contrato, la migración y su operación administrativa.

### Decisión de sesión para la SPA académica

Durante la integración, el access token se conservará únicamente en memoria del servicio/store de autenticación de la pestaña. Debe excluirse del mecanismo de persistencia Pinia actual: no guardarlo en LocalStorage, SessionStorage, URLs o archivos. Recargar la página requiere iniciar sesión otra vez. Las peticiones usan Authorization: Bearer y, al recibir 401 o alcanzar expiresIn, el frontend limpia la sesión y dirige a login. Un logout local elimina el token en memoria; no revoca por sí mismo una copia del token antes de expirar. No se implementan refresh tokens ni un endpoint de logout en este requisito. Cambiar una contraseña afecta el siguiente login, pero los access tokens ya emitidos siguen vigentes hasta expirar salvo eliminación de la cuenta. Esta política está documentada; la adaptación del frontend sigue pendiente y el contrato #39 continúa necesitando confirmación del equipo.

### Prueba desde PowerShell

Con el seed ejecutado y el backend iniciado en otra terminal:

```powershell
# Cuenta exclusivamente ficticia; conserva el token en una variable de esta terminal.
$session = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/auth/login' -ContentType 'application/json' -Body '{"email":"admin@soccer.example","password":"AdminDemo123"}'

# Muestra únicamente el perfil seguro obtenido del servidor.
Invoke-RestMethod -Method Get -Uri 'http://localhost:3000/api/auth/me' -Headers @{ Authorization = "Bearer $($session.accessToken)" }
```

La autenticación usa las versiones ya instaladas de NestJS/JwtService/bcrypt y los patrones de guards y metadatos de la documentación oficial: https://docs.nestjs.com/security/authentication y https://docs.nestjs.com/security/authorization. Las pruebas unitarias/e2e cubren login real, bcrypt, perfiles, claims, expiración, firma/algoritmo, metadatos de roles, cambios de usuario y ausencia de credenciales en logs. No se cambia el esquema SQLite.
