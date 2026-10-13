# Guía de estilo de programación

## 1. Objetivo

Esta guía define las convenciones mecánicas y las herramientas automáticas utilizadas por Soccer Dashboard. Explica **qué es cada herramienta, dónde se configura, cómo se ejecuta, cuándo se utiliza y qué significa un fallo**.

Las responsabilidades de las capas y las reglas de negocio pertenecen a [Reglas de programación](Programming-Rules.md), no a esta guía.

## 2. Principios de estilo compartidos

- TypeScript es obligatorio para el código de la aplicación.
- Se utiliza LF como final de línea, según `.gitattributes`.
- Prettier es la autoridad de formato: punto y coma, comillas simples y ancho de 100 caracteres.
- Se usa `const` por defecto; `let` únicamente cuando existe reasignación; `var` está prohibido.
- No se utiliza `any` para eludir el tipado. Una excepción exige justificación técnica en el PR.
- Los comentarios explican restricciones o decisiones no evidentes; no repiten el nombre de la operación.
- No se versionan dependencias, builds, cobertura, bases de datos, secretos ni archivos `.env`.
- No se desactivan reglas o se reducen umbrales únicamente para hacer pasar una verificación.

## 3. Herramientas de formato y análisis estático

| Herramienta | Qué es y qué verifica | Dónde se configura/aplica | Cómo se ejecuta | Cuándo se usa | Qué significa un fallo |
| --- | --- | --- | --- | --- | --- |
| Prettier | Formateador determinista de TypeScript, Vue, JSON, Markdown y archivos compatibles | `.prettierrc.json` de cada paquete; `.prettierignore`; archivos de `frontend/` y `backend/` | `npm run format:check`; `npm run format` solo para aplicar cambios intencionales | Durante el desarrollo, antes del commit y antes de aprobar el PR | Uno o más archivos no cumplen el formato compartido; debe aplicarse/revisarse el formato sin reescribir archivos ajenos |
| ESLint | Analizador estático para errores, imports, Vue y reglas TypeScript | `frontend/eslint.config.js` y `backend/eslint.config.mjs` | `npm run lint`; `npm run lint:fix` solo con revisión del diff | Después de cambiar código y antes del push | Existe una infracción. En backend `--max-warnings=0` hace que una advertencia también sea un fallo |
| TypeScript (`tsc`) | Comprueba tipos, módulos, opciones estrictas y compilación de código/tests | `tsconfig*.json` de ambos paquetes | Backend: `npm run type-check`; frontend se complementa con `vue-tsc` | Tras modificar contratos, DTOs, servicios, entidades, configuración o pruebas | El código no es válido para los contratos/tipos configurados |
| `vue-tsc` | Verifica TypeScript dentro de SFC, templates, props, emits y aliases Vue | `frontend/tsconfig*.json` | `npm run type-check` y `npm run type-check:test` | Después de modificar componentes, vistas, router o pruebas frontend | Hay incompatibilidad entre template, script o contrato de componente |
| Node test runner | Ejecuta las pruebas TypeScript del frontend sin incorporar otro framework | `frontend/test/*.test.ts`, script `test` | `npm test` | Después de cambiar API client, auth, router, servicios, composables o analítica | Existe una regresión, aserción fallida o operación asíncrona no controlada |
| Jest | Framework de pruebas unitarias y cobertura backend | `backend/jest.config.cjs`, archivos `*.spec.ts` y umbrales configurados | `npm test`; aprobación: `npm run test:cov` | Durante el desarrollo y antes de revisión | Falló comportamiento unitario, aislamiento o umbral de cobertura |
| Supertest + Jest | Ejercita la aplicación Nest real a nivel HTTP, incluyendo guards, DTOs y SQLite | `backend/test/*.e2e-spec.ts`, `test/jest-e2e.config.cjs` | `npm run test:e2e` | Tras cambios en controllers, auth, DTOs, base de datos o bootstrap | El contrato HTTP o la integración completa no cumple lo esperado |
| Build de Vite | Compila y empaqueta la SPA como producción | `frontend/vite.config.ts` y scripts del paquete | `npm run build-only`; incluido en `npm run verify` | Antes de aprobar cualquier cambio frontend | Un import, variable, bundle o configuración de producción es inválido |
| Build de Nest | Compila el servidor desplegable | `backend/nest-cli.json`, `tsconfig.build.json` | `npm run build`; incluido en `npm run verify` | Antes de aprobar cambios backend | El servidor de producción no puede compilarse |
| `npm audit` | Compara el lockfile con vulnerabilidades conocidas | `package-lock.json` de cada paquete | Frontend: `npm audit`; backend mínimo: `npm audit --omit=dev` | Tras cambiar dependencias y antes de revisión | Existe una vulnerabilidad que debe evaluarse y corregirse/documentarse; no se usa `--force` sin analizar cambios incompatibles |
| `git diff --check` | Detecta espacios inválidos y marcadores problemáticos en el patch | Repositorio completo | `git diff --check` o `git diff --cached --check` | Antes de commit, push y aprobación | El patch contiene errores de whitespace que deben corregirse |

## 4. Configuración de Prettier

Ambos paquetes utilizan:

```json
{
  "$schema": "https://json.schemastore.org/prettierrc",
  "semi": true,
  "singleQuote": true,
  "printWidth": 100
}
```

El flujo correcto es:

```powershell
npm run format:check
# Si falla por cambios propios:
npm run format
git diff
npm run format:check
```

No se debe ejecutar formato masivo sin inspeccionar qué archivos modifica. Los finales de línea se controlan con `.gitattributes`, no cambiando `endOfLine` para ocultar un problema local.

## 5. TypeScript

### 5.1 Tipos

- Parámetros, retornos y fronteras públicas deben tener contratos claros.
- Se aprovecha inferencia en variables locales evidentes.
- Los valores externos comienzan como `unknown` y se validan antes de usarse.
- Los estados cerrados se expresan como uniones literales.
- Se prefieren resultados discriminados como `ServiceResult<T>` frente a retornos ambiguos.
- Los imports utilizados solo en tipos usan `import type`.

Correcto:

```ts
function findUser(id: string): UserInterface | undefined {
  return users.find((user) => user.id === id);
}
```

Incorrecto:

```ts
function findUser(id: any): any {
  return users.find((user) => user.id === id);
}
```

### 5.2 Nombres

| Elemento | Convención | Ejemplo |
| --- | --- | --- |
| Variables y funciones | `camelCase` | `currentUser`, `loadTeams` |
| Clases, interfaces, DTOs, entidades y componentes | `PascalCase` | `ApiService`, `UserInterface`, `CreateUserDTO`, `Team` |
| Constantes verdaderamente globales | `UPPER_SNAKE_CASE` | `JSON_BODY_LIMIT` |
| Booleanos | Prefijo de condición | `isAuthenticated`, `hasPermission`, `canDelete` |
| Vistas | Sufijo `View.vue` | `PlayersView.vue` |
| Servicios | Sufijo `Service.ts` | `PlayerService.ts` |
| Controllers backend | Sufijo `.controller.ts` | `teams.controller.ts` |
| Services backend | Sufijo `.service.ts` | `teams.service.ts` |
| Entidades backend | Sufijo `.entity.ts` | `player.entity.ts` |
| Pruebas unitarias backend | Sufijo `.spec.ts` | `players.service.spec.ts` |
| Pruebas E2E backend | Sufijo `.e2e-spec.ts` | `players.e2e-spec.ts` |

Los nombres deben seguir los archivos reales del proyecto. No se documentan archivos retirados como `userstore.ts` o `PiniaConfig.ts`.

## 6. Imports y módulos

- Los imports se mantienen sin símbolos no utilizados.
- En frontend se usa `@/` para módulos dentro de `src` cuando evita rutas relativas largas.
- Los imports internos TypeScript siguen la extensión `.js` que requiere la configuración ESM.
- Los grupos y el orden quedan a cargo de ESLint/Prettier; no se aplican órdenes manuales contradictorios.
- Se evita el default export cuando el módulo ya utiliza exports nombrados, salvo convenciones del framework como el router.

```ts
import type { UserInterface } from '@/interfaces/UserInterface.js';
import { UserService } from '@/services/UserService.js';
```

## 7. Vue Single File Components

- Se utiliza `<script setup lang="ts">`.
- Props y emits son tipados.
- El template utiliza elementos semánticos, etiquetas de formularios y atributos de accesibilidad.
- La navegación interna utiliza `RouterLink` o el router, no recargas con `<a href>`.
- CSS específico permanece scoped cuando corresponda; tokens y patrones globales van a los assets compartidos.
- Se evita manipular el DOM directamente salvo para foco/accesibilidad mediante refs y ciclo de vida.

Ejemplo de contrato:

```ts
const props = defineProps<{ title: string; disabled?: boolean }>();
const emit = defineEmits<{ submit: []; cancel: [] }>();
```

## 8. Archivos de contratos backend

- DTOs de entrada: `create-*.dto.ts`, `update-*.dto.ts`.
- DTOs de respuesta: `*-response.dto.ts`.
- Decoradores reutilizados: archivos `*-validation.decorators.ts` o `common/validation`.
- Entidades: `entities/*.entity.ts`.
- Mappers: `*-response.mapper.ts`.
- Guards: `*.guard.ts`.

Las clases exportadas usan `PascalCase`; los nombres de archivo siguen el patrón existente en cada paquete.

## 9. Comentarios, mensajes y logging

- Un comentario explica **por qué** existe una restricción, una decisión de seguridad o una solución no evidente.
- No se comentan operaciones obvias ni se conserva código comentado.
- Los mensajes de validación son útiles, estables y no revelan datos internos.
- Los mensajes técnicos inesperados se registran de forma sanitizada en backend.
- Nunca se registran contraseñas, hashes, JWT, encabezados `Authorization`, secretos ni cuerpos sensibles.

## 10. Variables de entorno

- Los nombres de variables son `UPPER_SNAKE_CASE`.
- Frontend solo puede leer variables públicas con prefijo `VITE_`.
- Backend valida su configuración al iniciar.
- `.env.example` documenta nombres y valores no secretos.
- `.env` y `.env.*` reales no se versionan.
- Una URL, clave, contraseña o secreto dependiente del entorno no se escribe directamente en componentes o servicios.

## 11. Comandos exactos de verificación

### Frontend

```powershell
cd frontend
npm ci
npm run lint
npm run format:check
npm run type-check
npm run type-check:test
npm test
npm run build-only
npm audit --omit=dev
```

El equivalente integrado es:

```powershell
npm run verify
```

### Backend

```powershell
cd backend
npm ci
npm run lint
npm run format:check
npm run type-check
npm run test:cov
npm run test:e2e
npm run build
npm audit --omit=dev
```

El equivalente integrado, excepto la auditoría, es:

```powershell
npm run verify
```

### Repositorio

```powershell
git diff --check
git status --short
```

## 12. Procedimiento cuando una verificación falla

1. Leer el primer comando que falló; fallos posteriores pueden ser consecuencia.
2. Corregir la causa en el archivo y capa correspondientes.
3. Ejecutar el comando específico que falló.
4. Volver a ejecutar `npm run verify` del paquete.
5. Revisar `git diff --check`, `git status --short` y el diff staged.

Está prohibido silenciar ESLint, relajar TypeScript, excluir archivos de Prettier o reducir cobertura sin una decisión documentada y revisada.

