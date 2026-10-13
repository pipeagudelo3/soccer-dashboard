# Estado, persistencia y seeders

## 1. Propósito

En la primera entrega, Pinia y LocalStorage funcionaban como fuente de datos del navegador. Esa arquitectura fue retirada. El Entregable 2 utiliza una API y base de datos backend, por lo que estado cliente, persistencia y datos iniciales deben tener responsabilidades diferentes y explícitas.

## 2. Fuente de verdad actual

| Información | Responsable actual | ¿Persiste? |
| --- | --- | --- |
| Usuarios, equipos, jugadores y partidos | Services NestJS + TypeORM + SQLite | Sí |
| JWT, perfil autenticado y expiración | `frontend/src/stores/authstore.ts` | No; únicamente memoria |
| URL pública de la API | Configuración Vite | Configuración, no dato de dominio |
| Eliminación del estado antiguo | `LegacyStorageService` | Solo elimina `piniaState` |
| Datos ficticios de demostración | Clase `SeedService` en `backend/src/seed/seed.service.ts`, ejecutada por CLI | Sí, se insertan en SQLite |

Ya no existen `PiniaConfig.ts`, stores de dominio, seeders frontend ni `DomainSeeder`. Ningún documento o implementación nueva debe presentarlos como arquitectura vigente.

## 3. Pinia

Pinia coordina estado reactivo compartido; no es un repositorio ni una base de datos.

Solo permanece `authstore.ts`, que contiene:

- perfil autenticado;
- token de acceso;
- instante de expiración;
- estado de carga/verificación;
- error transitorio de sesión;
- versión utilizada para ignorar respuestas obsoletas.

El store **no puede**:

- guardar o restaurar su estado desde LocalStorage/sessionStorage;
- contener arrays CRUD de usuarios, equipos, jugadores o partidos;
- llamar directamente la base de datos;
- decidir autorización backend;
- conservar una sesión después de logout, expiración o un `401` que corresponda al token activo.

Recargar el navegador inicia sin sesión autenticada persistida. Esto es intencional y evita almacenar JWT en browser storage.

## 4. LocalStorage

LocalStorage ya no es la base de datos del proyecto y no participa en el flujo normal del dominio.

`LegacyStorageService.clearObsoleteState()` únicamente intenta ejecutar:

```ts
globalThis.localStorage.removeItem('piniaState');
```

El servicio no debe:

- leer o analizar el contenido antiguo;
- crear respaldos;
- hidratar Pinia;
- migrar usuarios o credenciales;
- escribir datos nuevos.

Si el navegador bloquea LocalStorage, la aplicación sigue funcionando porque la sesión en memoria y la API no dependen de ese almacenamiento.

Una futura clave de almacenamiento requiere una decisión arquitectónica explícita y nunca podrá contener contraseñas, hashes, JWT, perfiles ni tablas replicadas.

## 5. Persistencia backend

`DatabaseModule` abre SQLite con configuración validada y registra las entidades de dominio. TypeORM administra repositorios, relaciones y migraciones.

La integridad se protege en dos niveles:

1. DTOs/services validan y producen errores de negocio comprensibles antes de mutar.
2. Índices, foreign keys y `CHECK` impiden estado inválido incluso ante concurrencia o consumidores inesperados.

### Relaciones

| Relación | Campo normalizado | Regla |
| --- | --- | --- |
| Jugador → equipo | `teamId: string | null` | Opcional; borrar equipo ejecuta `SET NULL` |
| Partido → equipo local | `homeTeamId: string` | Obligatoria; borrar equipo está restringido |
| Partido → equipo visitante | `awayTeamId: string` | Obligatoria; borrar equipo está restringido |

Los equipos local y visitante deben ser diferentes. Fixtures y DTOs utilizan IDs, no objetos `Team` anidados.

## 6. Arquitectura de seed

Los seeds viven exclusivamente en `backend/src/seed` y se ejecutan mediante:

```powershell
cd backend
npm run seed
```

El comando destructivo para limpiar datos administrados por el seed solo se usa intencionalmente en desarrollo:

```powershell
npm run seed:clean
```

El módulo de seed es un composition root de CLI. No está importado por `AppModule`; por tanto, iniciar la API no inserta ni modifica datos automáticamente.

### 6.1 Fixtures

- Utilizan UUIDs constantes para reconocer registros aunque cambie un nombre visible.
- Relaciones usan `teamId`, `homeTeamId` y `awayTeamId`.
- Los equipos se crean/resuelven antes que jugadores y partidos.
- Las contraseñas ficticias se convierten en hashes antes de guardar.
- Incluyen casos útiles: roles admin/user, equipos múltiples, estados de jugador, ceros, jugador sin equipo y partidos históricos.
- Un valor `default` que no ejercite una regla, prueba o estado de interfaz debe eliminarse, no mantenerse como fallback inexplicado.

### 6.2 Transacción e idempotencia

`SeedService` utiliza la coordinación transaccional de escritura. Si una relación no se resuelve o una inserción falla, toda la operación se revierte.

Al ejecutar nuevamente el comando:

- IDs de fixtures existentes se omiten;
- partidos protegidos por identidad/unicidad no se duplican;
- datos editados por el usuario no se sobrescriben silenciosamente.

### 6.3 Por qué no existe `DomainSeeder`

Una abstracción genérica solo se justifica cuando varias implementaciones comparten un contrato real. En este proyecto existe un único flujo coordinado con orden de dependencias y una transacción, por lo que un `DomainSeeder` adicional no aporta reutilización y oculta el flujo.

## 7. Responsabilidades que no pertenecen a stores/seeders

- Validación de DTOs: backend DTOs y pipes.
- Duplicados, integridad y autorización: backend services.
- Operaciones multi-entidad: transacciones backend.
- Lectura/escritura persistente: repositorios TypeORM.
- Presentación y feedback: vistas/componentes frontend.
- Transporte HTTP: servicios frontend + `ApiService`.

Un store o seeder no debe duplicar esas responsabilidades.

## 8. Diseños prohibidos

- Seeders frontend ejecutados al iniciar Vue.
- `default`/fixture creado pero no consumido.
- Objetos `Team` anidados cuando el contrato espera IDs.
- `DomainSeeder` genérico sin una necesidad demostrada.
- Stores con CRUD, validación de negocio o persistencia del dominio.
- Restaurar el snapshot antiguo de LocalStorage.
- Ejecutar seeds durante el arranque normal del API.
- Sobrescribir datos existentes en cada ejecución.

## 9. Trazabilidad de las correcciones del profesor

| Observación de la primera entrega | Corrección aplicada |
| --- | --- |
| “Seeders, ojo con ese default que parece que no sirve para nada” | Cada fixture debe cubrir un caso real; se prohíben defaults/fallbacks sin consumidor o propósito verificable |
| “Ojo es con IDs de las relaciones” | `teamId`, `homeTeamId` y `awayTeamId` son los contratos de fixtures/DTOs; los objetos ORM son navegación interna |
| “DomainSeeder nada que ver ahí” | Se documenta que no existe y se prohíbe introducirlo sin varias implementaciones y reutilización demostrable |
| “Stores muchas funciones que nada que ver por la clase” | Solo permanece `authstore`; CRUD, validación y persistencia se delegan a services/API/TypeORM |
| “PiniaConfig que vimos en clase” | `PiniaConfig.ts` fue retirado junto con la hidratación/persistencia de dominio; se documenta el estado en memoria y el cleanup legado |
| “Mucho de eso va en los services” | Se asignan negocio/integridad a backend services y transporte/DTO mapping a frontend services |

## 10. Verificación

```powershell
rg "PiniaConfig|DomainSeeder|localStorage|piniaState|userstore|teamstore|playerstore|matchstatsstore" frontend/src backend/src docs
```

Se espera que cualquier coincidencia de LocalStorage/piniaState corresponda únicamente al cleanup y a documentación histórica/prohibitiva.

Además:

- ejecutar `npm run seed` dos veces sobre una base desechable y verificar que la segunda ejecución omite sin duplicar;
- provocar una relación inválida y verificar rollback sin datos parciales;
- comprobar que eliminar un equipo deja `player.teamId = null`;
- comprobar que un equipo con partidos no puede eliminarse;
- iniciar la API sin ejecutar el seed y confirmar que no inserta datos automáticamente.
