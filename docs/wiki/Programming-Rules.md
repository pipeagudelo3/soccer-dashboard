# Reglas de programación

## 1. Lenguaje obligatorio

- **DEBE / DEBEN:** requisito obligatorio.
- **PUEDE / PUEDEN:** alternativa permitida dentro de la arquitectura.
- **NO DEBE / NO PUEDEN:** comportamiento prohibido.

Estas reglas permiten revisar Pull Requests con criterios objetivos. Si una solución necesita romper una regla, el equipo debe aprobar y documentar primero el cambio arquitectónico.

## 2. Reglas de repositorio y trabajo

- Toda implementación **DEBE** corresponder a un issue del Project.
- Antes de comenzar, el responsable **DEBE** actualizar `main`, crear una rama dedicada, asignarse la tarea y moverla a `In Progress`.
- Un PR **DEBE** enlazar el issue, describir alcance, riesgos, pruebas y evidencia.
- El autor **NO DEBE** hacer commit directo a `main` ni mezclar funcionalidades independientes.
- **NO DEBEN** versionarse `.env`, secretos, bases SQLite, `node_modules`, `dist`, cobertura o artefactos generados.
- Los comandos `verify`, la auditoría aplicable y `git diff --check` **DEBEN** pasar antes de aprobar.
- Un cambio de arquitectura o herramienta **DEBE** actualizar su documentación en el mismo PR.

## 3. Frontend

### 3.1 Vistas

**Responsabilidad:** representar una ruta, componer la página y coordinar su estado de presentación.

- Una vista **DEBE** delegar transporte y operaciones de dominio a composables o servicios.
- **PUEDE** mantener filtros, selección y valores calculados exclusivos de la página.
- **DEBE** mostrar estados de carga, vacío, error y éxito cuando correspondan.
- **NO DEBE** importar Axios, construir URLs del backend, acceder a TypeORM ni persistir dominio en LocalStorage.
- **NO DEBE** duplicar reglas que ya ejecuta un servicio/backend.

Correcto:

```ts
const result = await TeamService.getTeams();
```

Incorrecto:

```ts
await axios.get('http://localhost:3000/api/teams');
```

### 3.2 Componentes reutilizables

**Responsabilidad:** encapsular una unidad visual o interactiva reutilizable.

- **DEBEN** usar props/emits tipados y mantener un contrato explícito.
- **PUEDEN** administrar estado visual local y foco.
- **DEBEN** delegar operaciones de dominio al consumidor o servicio previsto.
- **NO DEBEN** conocer tokens, API base URLs, repositorios ni entidades TypeORM.
- **NO DEBEN** crearse únicamente para dividir archivos sin una responsabilidad real.

### 3.3 Componentes de formulario

- **DEBEN** emitir DTOs o eventos tipados y conservar los datos del usuario cuando el servicio falla.
- **PUEDEN** validar interacción inmediata para mejorar UX.
- La respuesta backend **DEBE** seguir siendo autoritativa.
- **NO DEBEN** cerrar el formulario ni anunciar éxito si la operación fue rechazada.
- **NO DEBEN** modificar listas globales o ejecutar HTTP directamente.

### 3.4 Composables

**Responsabilidad:** reutilizar orquestación reactiva y ciclos de vida.

- **DEBEN** limpiar watchers, solicitudes o efectos que crean.
- **PUEDEN** coordinar varios servicios para un flujo de usuario.
- **DEBEN** protegerse contra respuestas obsoletas cuando hay concurrencia o cambio de sesión.
- **NO DEBEN** convertirse en stores globales ocultos ni llamar Axios directamente.

### 3.5 Servicios de dominio

**Responsabilidad:** exponer operaciones del frontend para cada recurso.

- **DEBEN** seleccionar endpoints, mapear DTOs y devolver `ServiceResult<T>`.
- **DEBEN** usar `ApiService` para el transporte.
- **PUEDEN** normalizar entradas de presentación antes de enviar el DTO.
- **NO DEBEN** manipular componentes, DOM o navegación.
- **NO DEBEN** contener arrays persistentes que repliquen la base de datos.

### 3.6 `ApiService`

- **DEBE** ser el punto central de Axios para la API.
- **DEBE** aceptar endpoints relativos y parámetros por `params`.
- **DEBE** leer el token actual por petición y limpiar únicamente una sesión coincidente ante `401`.
- **NO DEBE** aceptar URLs externas, credenciales en URL, rutas ascendentes o query strings incorporadas al endpoint.
- **NO DEBE** reintentar, navegar o abrir notificaciones automáticamente.

### 3.7 `ApiErrorService`

- **DEBE** transformar fallos de red/HTTP en mensajes seguros y predecibles.
- **PUEDE** conservar mensajes documentados de validación/conflicto.
- **NO DEBE** mostrar stacks, consultas SQL, respuestas internas, secretos ni diagnósticos crudos.
- **NO DEBE** decidir navegación o mutar recursos de dominio.

### 3.8 Pinia (`authstore`)

- Pinia **DEBE** almacenar únicamente estado compartido no derivable necesario para autenticación.
- `authstore` **DEBE** mantener token, perfil, expiración y banderas de verificación solo en memoria.
- **NO DEBE** guardar usuarios, equipos, jugadores o partidos como base de datos.
- **NO DEBE** persistir JWT, perfil o expiración en LocalStorage/sessionStorage.
- **NO DEBE** reemplazar servicios de dominio ni autorización backend.

### 3.9 Router y guards

- Las rutas **DEBEN** declarar `meta.title` y, cuando corresponda, `requiresAuth`/`requiresAdmin`.
- El guard **DEBE** esperar la verificación de sesión antes de mostrar contenido protegido.
- **PUEDE** preservar un destino interno seguro para regresar después del login.
- **NO DEBE** aceptar redirecciones externas ni crear bucles.
- Ocultar una ruta en el frontend **NO DEBE** considerarse autorización; el backend debe protegerla.

### 3.10 DTOs e interfaces

- **DEBEN** representar el contrato público del frontend, no entidades ORM.
- DTOs de creación/actualización **DEBEN** distinguir campos requeridos y opcionales.
- Relaciones **DEBEN** usar IDs normalizados.
- **NO DEBEN** incluir `passwordHash`, repositorios o propiedades de navegación TypeORM.

### 3.11 Utilidades analíticas

- **DEBEN** ser funciones puras y deterministas.
- **PUEDEN** combinar colecciones ya cargadas para producir métricas.
- **DEBEN** copiar antes de ordenar si el método podría mutar el arreglo original.
- **NO DEBEN** ejecutar HTTP, mutar stores ni ocultar fallos de carga.

## 4. Backend

### 4.1 Módulos

- Cada módulo **DEBE** registrar controllers, services, repositorios y dependencias de su dominio.
- **PUEDE** exportar únicamente proveedores necesarios por otro módulo.
- **NO DEBE** ejecutar seeds, migraciones o mutaciones al importarse.
- **NO DEBE** crear dependencias circulares para evitar una separación correcta.

### 4.2 Controllers

- **DEBEN** declarar rutas, códigos, Swagger, DTOs y guards.
- **DEBEN** delegar toda regla de negocio al service.
- **PUEDEN** seleccionar parámetros HTTP y devolver DTOs/mappers seguros.
- **NO DEBEN** acceder repositorios, escribir SQL, abrir transacciones ni hashear contraseñas.

Correcto:

```ts
return this.teamsService.create(dto);
```

Incorrecto:

```ts
return this.dataSource.getRepository(Team).save(dto);
```

### 4.3 DTOs y decoradores de validación

- Toda entrada externa **DEBE** validarse mediante DTOs/decoradores.
- Las actualizaciones **DEBEN** diferenciar ausencia de un valor explícito.
- Los decoradores compartidos **PUEDEN** agrupar reglas repetidas sin ocultar su intención.
- **NO DEBEN** aceptar objetos arbitrarios, propiedades desconocidas ni conversión implícita insegura.
- Los DTOs de respuesta **NO DEBEN** exponer hashes o propiedades internas.

### 4.4 Pipes y guards

- `ValidationPipe` **DEBE** mantener whitelist y rechazo de campos desconocidos.
- JWT guard **DEBE** proteger cada endpoint no público.
- Role guard **DEBE** proteger las operaciones administrativas.
- **NO DEBEN** implementar CRUD ni reglas de persistencia.

### 4.5 Services

- **DEBEN** aplicar invariantes, normalización, existencia, duplicados, relaciones y autorización sensible.
- **DEBEN** producir excepciones HTTP/domain seguras y coherentes.
- **PUEDEN** usar repositorios del módulo y servicios explícitamente inyectados.
- Escrituras multi-entidad **DEBEN** delegarse a `DatabaseWriteService`.
- **NO DEBEN** depender de Vue, LocalStorage, componentes, router ni objetos de respuesta Express.
- **NO DEBEN** confiar únicamente en validaciones frontend.

### 4.6 Repositorios y entidades TypeORM

- Repositorios **DEBEN** consumirse desde services backend.
- Entidades **DEBEN** declarar relaciones, índices y restricciones críticas.
- Toda relación **DEBE** tener política explícita de borrado.
- Cascades **NO DEBEN** habilitarse sin una regla de propiedad aprobada.
- Entidades con campos internos **NO DEBEN** serializarse ciegamente.
- Controllers y frontend **NO DEBEN** acceder repositorios.

### 4.7 Transacciones

- `DatabaseWriteService` **DEBE** coordinar operaciones atómicas multi-entidad.
- La validación previa **DEBE** ocurrir antes de la primera mutación cuando sea posible.
- Un fallo **DEBE** revertir la operación completa.
- **NO DEBE** existir una secuencia de escrituras parcialmente persistible cuando el caso exige atomicidad.

### 4.8 Autenticación y autorización

- Las contraseñas **DEBEN** hashearse con el servicio aprobado antes de persistir.
- `passwordHash` **DEBE** permanecer `select: false` y nunca aparecer en DTOs/logs.
- La autenticación protegida **DEBE** verificarse con JWT en backend.
- Las mutaciones administrativas **DEBEN** verificar rol en backend.
- El último administrador **DEBE** permanecer protegido por reglas de servicio.
- Secretos **DEBEN** provenir de configuración validada, nunca del repositorio.

### 4.9 Excepciones y códigos HTTP

- `400` **DEBE** representar entrada inválida; `401`, autenticación ausente/inválida; `403`, falta de permisos; `404`, recurso inexistente; `409`, conflicto de estado/unicidad.
- `ApiExceptionFilter` **DEBE** devolver un envelope estable.
- Errores inesperados **DEBEN** convertirse en respuesta genérica y log sanitizado.
- **NO DEBEN** exponerse stack traces, SQL, rutas internas o detalles de librerías.

### 4.10 Logging

- **PUEDE** registrar método, ruta segura, estado, duración y correlación necesaria.
- **DEBE** sanitizar valores controlados por el usuario.
- **NO DEBE** registrar contraseñas, hashes, JWT, `Authorization`, secretos ni información sensible.

### 4.11 Configuración

- Variables **DEBEN** validarse antes de crear la aplicación/base de datos.
- `.env.example` **DEBE** documentar todas las variables sin secretos reales.
- Configuración **NO DEBE** mezclarse con reglas de dominio ni hardcodearse en controllers/services.

### 4.12 Pruebas

- Un bug corregido **DEBE** incluir una prueba de regresión en el nivel más bajo efectivo.
- Reglas de service **DEBEN** tener pruebas unitarias.
- HTTP, guards, DTOs, base de datos y transacciones **DEBEN** tener cobertura E2E.
- Las pruebas **DEBEN** usar datos/SQLite aislados y ser independientes del orden.
- **NO DEBEN** consumir la base de producción, internet ni credenciales reales.
- Los umbrales **NO DEBEN** reducirse para hacer pasar un PR.

### 4.13 Seeds

- Los seeds **DEBEN** ejecutarse solo mediante CLI explícita.
- **DEBEN** usar IDs fijos y relaciones por ID.
- Equipos **DEBEN** resolverse antes que jugadores/partidos.
- Contraseñas **DEBEN** hashearse y la operación completa ser transaccional/idempotente.
- **NO DEBEN** ejecutarse durante el arranque normal ni sobrescribir datos editados.
- **NO DEBE** existir un `DomainSeeder` genérico sin múltiples implementaciones reales y necesidad demostrada.

### 4.14 Migraciones y despliegue

- Cambios de esquema **DEBEN** expresarse mediante migraciones revisables.
- Producción **NO DEBE** depender de `synchronize: true`.
- Imágenes Docker **DEBEN** construirse reproduciblemente desde un checkout limpio.
- `dist` **NO DEBE** versionarse; debe generarse durante el build.
- SQLite desplegado **DEBE** utilizar volumen persistente.
- Secretos de GCP/despliegue **NO DEBEN** incorporarse a imágenes, código, logs o capturas.

## 5. Estado, LocalStorage y persistencia

- SQLite mediante TypeORM **DEBE** ser la fuente persistente del dominio.
- LocalStorage **NO DEBE** almacenar dominio, credenciales, perfiles o tokens.
- `LegacyStorageService` **PUEDE** eliminar `piniaState`; **NO DEBE** restaurarlo, parsearlo, respaldarlo ni migrarlo.
- Stores frontend **NO DEBEN** contener CRUD ni reglas del dominio.

## 6. Revisión de Pull Requests

El revisor **DEBE** comprobar:

- correspondencia con el issue y alcance declarado;
- actualización con `main` y ausencia de conflictos;
- responsabilidades por capa;
- contratos, seguridad y relaciones;
- pruebas automáticas y manuales relevantes;
- ausencia de secretos/artefactos;
- documentación afectada;
- diff enfocado y limpio.

Un PR **NO DEBE** aprobarse únicamente porque compila o porque la prueba manual principal funcionó.

## 7. Definición de terminado

Una tarea solo puede pasar a `Done` cuando:

- [ ] El issue y el PR están enlazados y el alcance está completo.
- [ ] La rama está actualizada y el PR no tiene conflictos.
- [ ] Las responsabilidades de todas las capas se respetan.
- [ ] No existen secretos, artefactos generados ni dependencias innecesarias.
- [ ] Frontend/backend `verify` aplicable pasa desde instalación limpia.
- [ ] Pruebas de regresión relevantes pasan.
- [ ] Auditoría aplicable y `git diff --check` pasan.
- [ ] Las pruebas manuales del flujo afectado pasan.
- [ ] Documentación y diagramas coinciden con el código.
- [ ] Un integrante distinto revisó y aprobó, salvo una excepción de equipo documentada.
- [ ] El PR fue fusionado y el Project quedó actualizado.

