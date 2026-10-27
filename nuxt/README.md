# Soccer Dashboard · Entregable híbrido en Nuxt

Mini versión independiente del dashboard. Se agrega en `nuxt/` dentro del mismo
repositorio y conserva las aplicaciones anteriores de `frontend/` y `backend/`.
Esta entrega funciona con el servidor de Nuxt (Nitro): no necesita iniciar Nest,
crear una base de datos, ejecutar seeds ni autenticarse.

## 1. Requisitos del entregable

| Requisito                                  | Implementación                                                     | Evidencia                                                                |
| ------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Blog con tres artículos en un arreglo      | `app/data/articles.ts`, consultado mediante `ArticleService`       | `/blog` enlaza los tres detalles completos                               |
| Todas las páginas del blog en SSG          | `routeRules` y lista explícita en `nitro.prerender.routes`         | El build genera cuatro archivos `index.html` bajo `.output/public/blog/` |
| Listado y detalle de una clase del dominio | `Team`, proyección de la clase del diagrama existente              | `/teams` y `/teams/[id]`                                                 |
| Equipos definidos en la capa server        | `server/data/teams.ts` y `TeamCatalogService`                      | Ningún archivo de `app/` importa el arreglo de equipos                   |
| Consulta desde frontend a server con fetch | `TeamService` utiliza el `$fetch` de Nuxt                          | `GET /api/teams` y `GET /api/teams/:id`                                  |
| Páginas de equipos con SSR                 | `useAsyncData` espera el servicio; `ssr: true`, `prerender: false` | La respuesta HTTP ya contiene nombre y datos sin ejecutar JavaScript     |
| Ruta principal y dos secundarias con CSR   | `/tools`, `/tools/points`, `/tools/faq`                            | `ssr: false`, contenido construido en navegador                          |
| Publicación en GCP                         | A cargo de Juan Pablo; fuera del alcance de este PR                | Pendiente de despliegue y validación pública                             |

La interfaz identifica los equipos como ficticios. El catálogo utiliza UUID y una
proyección de `Team` con país, nombre, estadio y fecha de fundación. No agrega CRUD,
autenticación, gráficos ni persistencia, porque esta mini entrega no los requiere.

## 2. Ejecutar en Windows

Usar Node 24.15.0 o una versión posterior de la rama 24. Primero comprobar la versión
efectiva de la terminal; `nvm use` por sí solo no garantiza que otro Node instalado
no tenga prioridad en `PATH`.

Desde la raíz del repositorio:

```powershell
node --version
npm --version
Set-Location nuxt
npm ci
if ($LASTEXITCODE -ne 0) { throw 'Falló npm ci; no continuar.' }
npm run dev -- --host localhost --port 3001
```

Abrir `http://localhost:3001`. No se necesita `.env`: las peticiones son relativas
al mismo origen y Nuxt sirve la API. El puerto de desarrollo evita interferir con
un Nest que ya esté usando 3000.

Antes de reinstalar dependencias, detener con `Ctrl+C` los procesos de esta aplicación.
En Windows un proceso Vite activo puede bloquear los binarios de `node_modules`.

## 3. Recorrido del código

### Blog

`pages/blog` consulta `ArticleService`, que lee el arreglo tipado de artículos.
El build prerenderiza el índice y los tres slugs declarados en `nuxt.config.ts`.
Cada detalle valida que el slug exista; una URL desconocida responde 404.
Al agregar otro artículo se debe agregar su ruta al prerender y ampliar la prueba.

### Equipos

1. La página llama a `useAsyncData` con una clave propia de la lista o del ID.
2. El callback consulta `TeamService`.
3. El servicio utiliza `$fetch` para invocar `/api/teams` o `/api/teams/:id`.
4. El handler Nitro selecciona/valida el parámetro HTTP y delega a `TeamCatalogService`.
5. El servicio de servidor consulta el arreglo de `server/data/teams.ts`.
6. Nuxt incorpora el resultado en el HTML y en el payload de hidratación.

`useAsyncData` evita limitar la carga a `onMounted`: con `onMounted` el HTML inicial
no tendría los equipos. Los fixtures permanecen en código de servidor; sus datos
públicos sí viajan al cliente como parte del contrato y del payload.

El handler devuelve 400 si el identificador tiene formato inválido y 404 si no
existe. La página presenta ambas URLs no válidas como 404; un fallo inesperado del
servicio muestra un error genérico 503. El listado incluye carga, error con reintento
y estado vacío.

### Herramientas

`pages/tools.vue` proporciona el encabezado y la navegación de las dos subrutas
mediante `NuxtPage`. La calculadora mantiene `wins` y `draws` en `ref`; un `computed`
invoca `PointsUtils.calculatePoints`. No acepta vacíos, negativos, fracciones,
infinitos ni resultados que excedan los enteros seguros de JavaScript.

La página de preguntas utiliza `details` y `summary`, controles nativos accesibles
con teclado. Ninguna herramienta requiere una petición de datos ni guarda estado.

## 4. Convenciones de esta aplicación

Estas convenciones adaptan la retroalimentación del profesor a Nuxt. Las reglas de
la antigua SPA sobre `src/views`, Vue Router manual, Pinia, Axios y LocalStorage no
son requisitos del nuevo proyecto.

- TypeScript estricto, contratos compartidos en `shared/interfaces/`, sin `any`.
- Componentes con `<script setup lang="ts">`, props tipadas y presentación semántica.
- Servicios y utilidades como clases con métodos estáticos. No hay funciones de
  formato sueltas en las páginas. Los callbacks de Vue, Nuxt y Nitro siguen su API.
- `FormatUtils` centraliza fechas y fija UTC para no cambiar el día entre SSR y
  navegador. `PointsUtils` encapsula el cálculo puro y su validación.
- Imports de código propio estáticos. `~/` identifica `app/`; `~~/server/`, servidor;
  `#shared/`, contratos comunes. Son tres ámbitos distintos, no estilos alternativos
  para el mismo archivo. Los módulos TypeScript se importan sin extensión y los
  componentes con `.vue`.
- APIs de Nuxt explícitas desde `#imports`, componentes del framework desde
  `#components`, reactividad desde `vue` y handlers desde `h3`.
- Se desactivan los autoimports de aplicación y componentes propios. La carga de
  páginas que genera Nuxt internamente sigue siendo responsabilidad del framework.
- Los archivos de configuración y pruebas que ejecuta Node usan rutas relativas;
  las pruebas nativas importan `.ts` porque no pasan por el resolvedor de Nuxt.
- ESLint comprueba imports de tipos, miembros importados y símbolos sin uso; también
  prohíbe imports dinámicos, rutas relativas y el alias alternativo `@/` dentro de la
  aplicación. `test/imports.test.mjs` verifica el orden alfabético de módulos y la
  separación entre imports externos e internos, sin dependencias adicionales.
- Se usa orden alfabético en contratos, métodos y declaraciones independientes;
  las declaraciones derivadas van después de sus dependencias.
- Comentarios para decisiones no evidentes, sin comentar cada línea ni conservar
  código muerto. Prettier controla formato; `.gitattributes` local fija LF.
- `PageIntro` y `ContentCard` comparten presentación entre varias páginas sin
  conocer datos ni transporte. No se crean capas genéricas adicionales.
- `NuxtLink` para navegación interna, nombres de página, skip link, foco visible,
  controles etiquetados y áreas de interacción adaptadas a pantallas pequeñas.

## 5. Verificación automática

```powershell
npm run verify
if ($LASTEXITCODE -ne 0) { throw 'Falló verify; revisar el primer error.' }
npm audit
git status --short
git diff --check
```

`verify` ejecuta ESLint, Prettier, TypeScript, build y pruebas. Las pruebas arrancan
un servidor de producción en un puerto local libre y lo detienen al terminar.
Se ejecutan con el test runner de Node, sin otro framework de pruebas.

- `test/rendering.test.mjs`: archivos reales SSG, contenido SSR en las respuestas,
  ausencia de páginas estáticas para equipos/herramientas, shell CSR, contrato API
  y códigos de error. No se limita a inspeccionar la configuración.
- `test/utils.test.mjs`: cálculo de puntos, valores inválidos y fechas en distintas
  zonas horarias.
- `test/imports.test.mjs`: agrupación de imports externos/internos y orden alfabético.

`npm test` requiere haber ejecutado `npm run build`; `verify` lo hace en orden.
Con la prueba de imports añadida, el conteo esperado es de diez pruebas, incluyendo
el contenedor de integración. Repetir `npm run verify` para confirmar el total.
El éxito de estas pruebas no reemplaza recorrer la interfaz con JavaScript habilitado.

Verificación realizada el 25 de octubre de 2026, con Node 24.22.1 y npm 11.9.0:
`npm run verify` completo y nueve pruebas correctas antes del ajuste de imports.
Una revisión adicional en
Chromium comprobó la navegación entre los tres artículos y cuatro equipos,
calculadora válida/inválida, FAQ, skip link, ausencia de errores de hidratación y
32 combinaciones de ruta/ancho (320, 375, 768 y 1280 px) sin overflow horizontal.
También se verificó blog y equipos con JavaScript desactivado y el shell vacío de CSR.
El despliegue en GCP lo realizará Juan Pablo fuera de este PR. La verificación
en la URL pública quedará pendiente hasta que esté disponible.

## 6. Prueba manual de producción

```powershell
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Falló build; no iniciar producción.' }
$env:HOST = '127.0.0.1'
$env:PORT = '3001'
npm start
```

1. Abrir Inicio, Blog, Equipos y Herramientas desde la navegación.
2. Abrir los tres artículos, volver al índice y recargar un detalle directamente.
3. Abrir los cuatro equipos y comprobar nombre, país, estadio y fecha.
4. Abrir `/teams/invalid` y `/blog/no-existe`: deben mostrar una página 404.
5. En calculadora, probar 4 victorias + 2 empates = 14; 0 + 0 = 0. Vaciar un campo,
   introducir -1 y 1.5: no deben aparecer puntos válidos.
6. Navegar entre calculadora y preguntas usando el menú de herramientas.
7. Abrir preguntas con teclado; recorrer enlaces e inputs con Tab. El primer
   enlace del documento permite saltar al contenido.
8. Probar 320, 375 y 1280 px y zoom 200%; sin desplazamiento horizontal de página.
9. Revisar consola: sin errores de aplicación ni advertencias de hidratación.
10. Con JavaScript desactivado, recargar `/blog` y `/teams`: muestran contenido.
    `/tools/points` solo tiene el shell, como corresponde a CSR.

## 7. Dependencias y hallazgo de auditoría

Nuxt 4.6.2, Vue y Vue Router constituyen la aplicación. `h3` se declara directamente
porque los handlers lo importan. ESLint 10 es compatible con las dependencias
resueltas de `@nuxt/eslint`; Prettier y `vue-tsc` completan la verificación.
`package-lock.json` se versiona para que `npm ci` reproduzca la instalación.

La auditoría del 25 de octubre de 2026 reporta siete entradas de severidad alta
derivadas de una vulnerabilidad de `node-forge@1.4.0`, mediante
`nuxt → @nuxt/nitro-server → nitropack → listhen → node-forge`.
El aviso [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv)
no publica una versión corregida. Siete entradas no significan siete fallos
independientes. No se aplicó el downgrade que propone `npm audit fix --force`.

En el build inspeccionado, `node-forge` y `listhen` no aparecen en los módulos ni
en las dependencias del servidor `.output`. Se conserva el hallazgo para revisión:
la instalación del proyecto NO tiene una auditoría limpia y el resultado puede
cambiar con nuevas versiones. Antes de desplegar, repetir auditoría y revisión
del artefacto. No exponer el servidor de desarrollo a internet.

## 8. Coordinación del despliegue

La publicación en GCP será realizada por Juan Pablo en su trabajo separado;
no se incluyen archivos de Docker ni configuración de infraestructura en este PR.

Esta aplicación conserva el servidor Nitro necesario para SSR y para los
endpoints `/api/teams`. Una publicación completamente estática de
`.output/public` no cubriría esas funcionalidades.
