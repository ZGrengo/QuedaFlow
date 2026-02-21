# QuedaFlow

MVP para encontrar huecos de horarios entre compañeros.

## Arquitectura

### Monorepo Structure

```
quedaflow/
├── apps/
│   └── web/              # Angular 17+ standalone app
├── packages/
│   └── domain/           # Lógica de dominio pura y testeable
└── supabase/
    └── migrations/       # Migraciones SQL con RLS
```

### Separación de Responsabilidades

- **UI (apps/web)**: Componentes Angular, routing, formularios
- **Data Access (services)**: Comunicación con Supabase, mapeo de datos
- **Domain Logic (packages/domain)**: Cálculo de slots, manipulación de bloques, funciones puras

### Stack Tecnológico

**Frontend:**
- Angular 17+ (standalone components)
- Angular Material (UI components)
- RxJS (reactive programming)
- Supabase JS Client

**Backend:**
- Supabase (PostgreSQL + Auth + RLS)
- Row Level Security (RLS) para seguridad

## Configuración Local

### Prerrequisitos

- Node.js 18+
- npm o yarn
- Supabase CLI (opcional, para desarrollo local)

### Variables de Entorno

Crea un archivo `.env` en `apps/web/`:

```env
NG_APP_SUPABASE_URL=your_supabase_project_url
NG_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Instalación

```bash
# Instalar dependencias del workspace
npm install

# Instalar dependencias del domain package
cd packages/domain
npm install

# Instalar dependencias de la app web
cd ../../apps/web
npm install
```

### Desarrollo

```bash
# Desde la raíz del proyecto
npm run dev:web

# O desde apps/web
cd apps/web
npm start
```

La app estará disponible en `http://localhost:4200`

### Tests del Domain Package

```bash
cd packages/domain
npm test
npm run test:watch
```

## Supabase Setup

### 1. Crear Proyecto Supabase

1. Ve a [supabase.com](https://supabase.com)
2. Crea un nuevo proyecto
3. Copia la URL y la anon key

### 2. Ejecutar Migraciones

En Supabase Dashboard:
1. Ve a SQL Editor
2. Ejecuta las migraciones en orden:
   - `001_initial_schema.sql`
   - `002_rls_policies.sql`
   - `003_functions_and_triggers.sql`

O usando Supabase CLI:

```bash
supabase db push
```

### 3. Configurar Auth

En Supabase Dashboard:
1. Ve a Authentication > Providers
2. Habilita Email provider
3. Configura redirect URLs:
   - `http://localhost:4200/**`
   - Tu dominio de producción

## Diseño de RLS (Row Level Security)

### Principios de Seguridad

1. **Autenticación Requerida**: Todas las tablas requieren usuario autenticado
2. **Aislamiento por Grupo**: Usuarios solo ven datos de grupos a los que pertenecen
3. **Propiedad de Datos**: Usuarios solo pueden modificar sus propios bloques
4. **Roles**: Solo el host puede modificar configuración del grupo

### Políticas Clave

- **profiles**: Usuarios ven/modifican solo su propio perfil
- **groups**: Usuarios ven grupos donde son miembros
- **group_members**: Usuarios ven miembros de sus grupos
- **availability_blocks**: Usuarios insertan/modifican solo sus propios bloques
- **group_blocked_windows**: Solo host puede gestionar ventanas bloqueadas

## Decisiones Técnicas

### Angular Standalone

- **Razón**: Simplifica la arquitectura, reduce boilerplate
- **Beneficio**: Mejor tree-shaking, bundles más pequeños

### RxJS vs Signals

- **Decisión**: RxJS para esta versión
- **Razón**: Supabase client usa Observables, integración más natural
- **Futuro**: Considerar Signals en Angular 18+ cuando Supabase lo soporte mejor

### Domain Package Separado

- **Razón**: Lógica testeable independiente del framework
- **Beneficio**: Tests rápidos, reutilizable, fácil de mantener

### RLS en Supabase

- **Razón**: Seguridad a nivel de base de datos
- **Beneficio**: Imposible bypassear desde el cliente, menos código de validación

## Modelo de Datos

### Tablas Principales

- **profiles**: Extiende auth.users
- **groups**: Grupos con configuración
- **group_members**: Relación usuarios-grupos con roles
- **availability_blocks**: Bloques de disponibilidad (WORK/UNAVAILABLE/PREFERRED)
- **group_blocked_windows**: Ventanas bloqueadas por grupo

### Validaciones

- Máximo 3 bloques PREFERRED por usuario por grupo (trigger)
- Bloques que cruzan medianoche se dividen automáticamente
- Buffer aplicado a bloques WORK antes de guardar
- Bloques solapados se fusionan automáticamente

## Rutas

- `/login` - Autenticación con magic link
- `/g/:code` - Vista del grupo
- `/g/:code/blocks` - Gestión de bloques de disponibilidad
- `/g/:code/planner` - Vista de mejores huecos calculados

## Roadmap

### MVP Actual ✅
- [x] Autenticación con Supabase Auth (magic link)
- [x] Crear/unirse a grupos
- [x] Gestión de bloques de disponibilidad
- [x] Cálculo de mejores huecos
- [x] RLS completo

### Próximas Features

- [ ] **OCR para bloques**: Carpeta `apps/web/src/app/features/ocr/` preparada
- [ ] **Emails**: Notificaciones cuando hay nuevos huecos
- [ ] **Exportar calendario**: iCal export
- [ ] **Múltiples grupos**: Dashboard con lista de grupos
- [ ] **Configuración avanzada**: Más opciones de buffer y thresholds

### Deploy

- **Cloudflare Pages**: Configuración pendiente
- Variables de entorno en Cloudflare Dashboard
- Build command: `cd apps/web && npm run build`

## Estructura de Carpetas Detallada

```
apps/web/
├── src/
│   ├── app/
│   │   ├── core/
│   │   │   ├── config/        # Configuración Supabase
│   │   │   ├── guards/         # Route guards
│   │   │   └── services/       # Servicios Angular
│   │   ├── features/
│   │   │   ├── auth/           # Login component
│   │   │   ├── group/          # Group detail
│   │   │   ├── blocks/         # Blocks manager
│   │   │   ├── planner/        # Planner view
│   │   │   └── ocr/            # (Placeholder para futuro)
│   │   └── app.routes.ts       # Routing configuration
│   └── environments/           # Environment variables

packages/domain/
├── src/
│   ├── time.ts                 # Utilidades de tiempo
│   ├── blocks.ts                # Manipulación de bloques
│   ├── compute.ts               # Cálculo de slots
│   └── types.ts                 # TypeScript interfaces
└── tests/                       # Tests unitarios

supabase/
└── migrations/
    ├── 001_initial_schema.sql
    ├── 002_rls_policies.sql
    └── 003_functions_and_triggers.sql
```

## Checklist de Implementación

### Setup Inicial
- [x] Estructura de monorepo
- [x] Angular 17+ con Material
- [x] Domain package con tests
- [x] Migraciones SQL con RLS

### Funcionalidades Core
- [x] Autenticación (magic link)
- [x] Crear grupo
- [x] Unirse a grupo por código
- [x] Añadir bloques (WORK/UNAVAILABLE/PREFERRED)
- [x] Validación máximo 3 PREFERRED
- [x] Cálculo de slots
- [x] Ranking de mejores huecos

### UI/UX
- [x] Login page
- [x] Group detail page
- [x] Blocks manager
- [x] Planner view con colores

### Seguridad
- [x] RLS en todas las tablas
- [x] Policies para cada operación
- [x] Validaciones en triggers
- [x] Auth guard en rutas protegidas

## Troubleshooting

### Warnings de npm install

Es normal ver warnings sobre paquetes deprecados y vulnerabilidades al ejecutar `npm install`. Estos vienen principalmente de dependencias transitivas de Angular CLI y no afectan la funcionalidad. Ver `SECURITY.md` para más detalles.

**Puedes continuar con el desarrollo normalmente.**

### Error: Missing Supabase environment variables
- Verifica que `.env` existe en `apps/web/`
- Reinicia el servidor de desarrollo

### Error: RLS policy violation
- Verifica que el usuario está autenticado
- Verifica que el usuario pertenece al grupo
- Revisa las policies en `002_rls_policies.sql`

### Error: Maximum 3 PREFERRED blocks
- Es una validación intencional
- Elimina un bloque PREFERRED existente antes de añadir uno nuevo

## Contribuir

1. Crea una rama desde `main`
2. Implementa cambios
3. Ejecuta tests: `npm run test:domain`
4. Verifica linting
5. Crea PR

## Licencia

MIT

