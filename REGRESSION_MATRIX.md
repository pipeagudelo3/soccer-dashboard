# Matriz de regresión full-stack — #56

Base: PR #72, commit `b19cf1342dee63fe6b0ac09ee8da8637a43b3abd`.

## Evidencia automatizada ejecutada

Estos casos ejecutan servicios y composables reales mediante Vite SSR, Axios, HTTP, NestJS,
TypeORM y SQLite. El router usa historial en memoria y el guard real. No son pruebas de
interacción ni renderizado en un navegador. Las respuestas vacías, lentas y 500 se inyectan
en un proxy temporal; los demás casos usan el backend real. No hay fixtures de dominio
frontend ni dependencia HTTP nueva.

| ID      | Escenario y resultado esperado                                                             | Resultado |
| ------- | ------------------------------------------------------------------------------------------ | --------- |
| DB-01   | Isolated SQLite migrations and idempotent explicit backend seed                            | PASS      |
| ST-01   | Legacy cleanup removes only piniaState without reading or recreating fixtures              | PASS      |
| AUTH-01 | Administrator login normalizes email and keeps a safe in-memory profile                    | PASS      |
| AUTH-02 | Unknown email and wrong password return identical generic 401 feedback                     | PASS      |
| AUTH-03 | Missing, invalid and expired JWTs are rejected on every protected domain                   | PASS      |
| AUTH-04 | Real backend role checks reject regular-user direct mutations with 403                     | PASS      |
| AUTH-05 | Actual guard with real auth/me permits admin routes and prevents guest/user loops          | PASS      |
| US-01   | Users create/read/update/delete through Axios and Nest return safe database records        | PASS      |
| US-02   | Duplicate email, invalid role/password and stale user IDs preserve consistent feedback     | PASS      |
| US-03   | Last administrator cannot be removed or demoted                                            | PASS      |
| US-04   | Role changes and deleted accounts invalidate old authority on protected requests           | PASS      |
| TM-01   | Teams create/read/update and duplicate/invalid checks use the database                     | PASS      |
| PL-01   | Players create/update preserve nine fields and nullable normalized teamId                  | PASS      |
| PL-02   | Unknown teams, invalid status/counts and stale player IDs are rejected                     | PASS      |
| MA-01   | Matches create/read/update retain ten fields, real dates and zero values                   | PASS      |
| MA-02   | Different existing teams, real non-future dates and finite nonnegative counts are required | PASS      |
| MA-03   | Exact duplicates are rejected; unchanged edited identity excludes its own record           | PASS      |
| AN-01   | Coherent Vue snapshots and analytical calculations match real backend fixtures             | PASS      |
| UI-01   | Loading hides readiness until all real dependent HTTP reads complete                       | PASS      |
| UI-02   | Injected dependency 500 prevents partial analysis and supports explicit retry              | PASS      |
| UI-03   | Injected empty lists expose empty state without invented fixtures or chart data            | PASS      |
| UI-04   | Stale records disappear after real deletion and the editor remains safely blocked          | PASS      |
| AUTH-06 | An invalid active token clears session on 401 without request retry loops                  | PASS      |
| DB-02   | Stopping the real backend produces a safe network error with no local fallback             | PASS      |
| DB-03   | A new backend process and new Pinia instance preserve SQLite records after re-login        | PASS      |
| REL-01  | Teams with matches return 409; after match deletion players become null atomically         | PASS      |
| HTTP-01 | CORS preflight accepts only the configured origin and JWT headers                          | PASS      |
| LOG-01  | Backend child logs contain no secrets, tokens or unhandled runtime errors                  | PASS      |

## Cobertura complementaria existente

`npm run verify` del frontend ejecutó 149 pruebas. Las suites `api-client`, `backend-auth`,
`users-api`, `users-session-lifecycle`, `teams-players-api`, `match-analytics-api` y
`legacy-storage` cubren la normalización de errores, carreras de sesión, conservación de
formularios y feedback, cancelación de borrado sin solicitudes, datos analíticos y limpieza
sin leer ni escribir fixtures. Algunas comprobaciones de formularios usan renderizado SSR;
no sustituyen los pasos de navegador siguientes.

Backend: 159 pruebas unitarias y 324 e2e, incluyendo los módulos de autenticación, Users,
Teams, Players, MatchStats, relaciones, seed y migraciones.

## Matriz de navegador pendiente

Repetir con datos aislados según `REGRESSION_EVIDENCE.md`. Registrar resultado, fecha,
versión de navegador, captura sin datos sensibles y defecto asociado si corresponde.
`PENDIENTE` significa que no fue ejecutado en este entorno.

| ID   | Pasos                                                                                                               | Resultado esperado                                                                                            | Estado    |
| ---- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------- |
| B-01 | Login y logout con administrador y usuario regular; probar email inexistente y contraseña incorrecta.               | Identidad y menú correctos; error genérico; logout oculta contenido protegido.                                | PENDIENTE |
| B-02 | Abrir cada ruta protegida directamente como invitado; entrar a rutas admin como usuario regular.                    | Redirección segura sin bucles ni flash de contenido protegido.                                                | PENDIENTE |
| B-03 | Recargar una página autenticada.                                                                                    | Sesión en memoria perdida; acceso requiere login; después del login reaparece la misma información de SQLite. | PENDIENTE |
| B-04 | Invalidar el token activo o esperar su expiración; solicitar datos.                                                 | 401 cierra sesión; ningún bucle ni contenido privado persistido.                                              | PENDIENTE |
| B-05 | Admin crea, consulta, edita y elimina un usuario. Cambiar/eliminar la cuenta activa desde una segunda sesión admin. | Lista y feedback se actualizan sin reload; sesión refleja rol actual o se cierra.                             | PENDIENTE |
| B-06 | Probar email duplicado, rol/contraseña inválidos y eliminación/degradación del último admin.                        | Errores visibles; formulario conserva datos; última cuenta admin protegida.                                   | PENDIENTE |
| B-07 | CRUD de equipos y jugadores; asignar/quitar teamId; probar status/números/teamId inválidos.                         | API persiste; relación nullable; errores inline mantienen el formulario abierto.                              | PENDIENTE |
| B-08 | Eliminar equipo con partidos, después sin partidos pero con jugadores.                                              | Primero conflicto claro; después jugadores quedan sin equipo y la UI se actualiza.                            | PENDIENTE |
| B-09 | CRUD de partidos; equipos iguales/desconocidos, fecha imposible/futura, duplicado y valores negativos.              | IDs normalizados; validación y duplicados claros; editar el propio registro sin cambiar identidad se permite. | PENDIENTE |
| B-10 | Cancelar confirmaciones SweetAlert2 en los cuatro dominios; observar Network.                                       | No hay solicitud de borrado; modal y foco utilizables.                                                        | PENDIENTE |
| B-11 | Borrar un registro desde otra sesión y editar/borrar el registro visible.                                           | Feedback 404 claro y listado reconciliado; no se abre un formulario vacío.                                    | PENDIENTE |
| B-12 | Usuario regular visita catálogos y manipula la UI intentando mutar.                                                 | Lectura permitida; acciones de admin ausentes; API rechaza escritura con 403.                                 | PENDIENTE |
| B-13 | Visitar Dashboard, MatchStats, Statistics y Team Comparison; cambiar cada filtro y selección.                       | Tablas, captions y Chart.js coinciden con datos y cálculos esperados; no se recarga la página.                | PENDIENTE |
| B-14 | Probar equipos sin partidos/jugadores, estadísticas en cero y listas vacías en una segunda base aislada.            | Estados vacíos claros y gráficos sin datos inventados ni NaN.                                                 | PENDIENTE |
| B-15 | Network con conexión lenta, backend apagado y un endpoint bloqueado; pulsar Retry después de restaurarlo.           | Loading accesible; no aparecen gráficos parciales engañosos; error claro y recuperación.                      | PENDIENTE |
| B-16 | Cambiar rol admin a user con formulario abierto; probar 403 y 500 mediante proxy de pruebas.                        | UI refleja rol; feedback seguro; no expone detalles internos ni pierde drafts injustificadamente.             | PENDIENTE |
| B-17 | DevTools Application: dejar piniaState antiguo y una preferencia ajena; recargar.                                   | Se elimina solo piniaState; no se recrean datos locales, hashes, contraseñas ni tokens persistidos.           | PENDIENTE |
| B-18 | Inspeccionar Console y logs durante todos los casos.                                                                | Sin excepciones no controladas ni contraseñas, hashes, JWT o secretos.                                        | PENDIENTE |

## Contenedores y evidencia final

| ID   | Comprobación                                                                                                       | Resultado esperado                                                               | Estado                                                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| C-01 | Crear registros, reiniciar frontend/backend con la configuración de despliegue aprobada y el mismo volumen SQLite. | Datos conservados después de volver a autenticar; no se ejecuta seed implícito.  | PENDIENTE: Docker/configuración de contenedores no disponibles en esta base |
| C-02 | Repetir login, lecturas y un CRUD a través del frontend desplegado tras el reinicio.                               | URL y CORS correctos; Vue → Axios → Nest → SQLite funciona en la topología real. | PENDIENTE                                                                   |
| E-01 | Adjuntar matriz y JSON al PR/Wiki y registrar resultados manuales.                                                 | Evidencia revisable, con fecha, versión, commit y pendientes visibles.           | PENDIENTE: publicación por el responsable del PR                            |

No se detectaron defectos funcionales en las comprobaciones ejecutadas. Si un paso pendiente
falla, abrir un issue separado con ID de matriz, pasos, resultado esperado/obtenido, commit,
rol, entorno y evidencia sanitizada; enlazarlo aquí y en el PR. No cerrar #56 hasta completar
las comprobaciones obligatorias pendientes.
