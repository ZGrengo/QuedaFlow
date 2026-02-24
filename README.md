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
   - `001_schema.sql`
   - `002_rls_policies.sql`
   - `003_functions_and_triggers.sql`
   - `004_grants_public_schema.sql`
   - `005_create_group_rpc.sql`
   - `006_fix_generate_group_code_ambiguous.sql`
   - `007_join_group_by_code_rpc.sql`
   - `008_group_planning_settings.sql`
   - `009_rls_and_triggers_validations.sql`
   - `010_group_delete_policy.sql`
   - `011_limit_max_groups_per_user.sql`

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
- **groups**: Usuarios ven grupos donde son miembros; solo host puede actualizar
- **group_members**: Usuarios ven miembros de sus grupos
- **availability_blocks**: Usuarios insertan/modifican solo sus propios bloques; fecha debe estar en rango planning y no en pasado
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

### Validaciones y Reglas del Host

- **Ventana de planificación**: El host define `planning_start_date` y `planning_end_date`. Los bloques solo pueden crearse dentro de ese rango y el planner solo calcula dentro de él.
- **No bloques en pasado**: No se permiten bloques con `date < today` (todos los tipos).
- **Buffer antes de trabajo**: El host define `buffer_before_work_min` (default 20). Para el cálculo, los bloques WORK "ocupan" también ese buffer antes del inicio (no se modifica el bloque guardado).
- **Blocked windows**: El host define franjas excluidas del cálculo (ej. 00:00-07:59).
- **Máximo 3 PREFERRED** por usuario dentro del rango planning (trigger).
- **Máximo 5 grupos creados** por usuario (como host); se aplica en la RPC `create_group`.
- **Duración mínima reunión**: `min_meeting_duration_min` (default 60) para rankeo futuro.

## Rutas

- `/login` - Autenticación con magic link
- `/g/:code` - Vista del grupo
- `/g/:code/settings` - Configuración del grupo (solo host)
- `/g/:code/blocks` - Gestión de bloques de ocupación
- `/g/:code/planner` - Vista de mejores huecos calculados
- `/g/:code/import` - Importar horarios por OCR

## Roadmap

### MVP Actual ✅
- [x] Autenticación con Supabase Auth (magic link)
- [x] Crear/unirse a grupos
- [x] Gestión de bloques de disponibilidad
- [x] Cálculo de mejores huecos
- [x] RLS completo

### Próximas Features

- [x] **OCR para bloques**: Importar horarios desde capturas de pantalla (Mapal-like)
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
│   │   │   └── ocr/            # Import OCR feature
│   │   └── app.routes.ts       # Routing configuration
│   └── environments/           # Environment variables

packages/domain/
├── src/
│   ├── time.ts                 # Utilidades de tiempo
│   ├── blocks.ts                # Manipulación de bloques
│   ├── compute.ts               # Cálculo de slots
│   ├── ocr-parse.ts             # Parser OCR para Mapal-like
│   └── types.ts                 # TypeScript interfaces
└── tests/                       # Tests unitarios

supabase/
└── migrations/
    ├── 001_schema.sql
    ├── 002_rls_policies.sql
    ├── 003_functions_and_triggers.sql
    ├── 004_grants_public_schema.sql
    ├── 005_create_group_rpc.sql
    ├── 006_fix_generate_group_code_ambiguous.sql
    ├── 007_join_group_by_code_rpc.sql
    ├── 008_group_planning_settings.sql
    ├── 009_rls_and_triggers_validations.sql
    ├── 010_group_delete_policy.sql
    └── 011_limit_max_groups_per_user.sql
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
- Es una validación intencional (máx 3 dentro del rango planning)
- Elimina un bloque PREFERRED existente antes de añadir uno nuevo

### Error: Fuera del rango de planificación / fecha pasada
- Los bloques deben tener fecha dentro de `planning_start_date` y `planning_end_date` del grupo
- No se permiten fechas pasadas
- El host puede ampliar el rango en Configuración del grupo

## Importar Horarios por OCR

### Descripción

La funcionalidad de Import OCR permite subir una captura de pantalla de tu app de horarios (formato Mapal-like) y el sistema detectará automáticamente los turnos de trabajo.

### Cómo Usar

1. **Accede a la página de importación**: Navega a `/g/:code/import` desde cualquier grupo
2. **Sube una imagen**: Selecciona un archivo PNG o JPG con la captura de tu horario
3. **Analiza con OCR**: Haz clic en "Analizar con OCR" y espera a que procese (puede tardar unos segundos)
4. **Revisa y edita**: El sistema mostrará los turnos detectados. Puedes:
   - Editar fecha, hora de inicio y fin de cada turno
   - Eliminar turnos incorrectos
   - Añadir turnos manualmente
5. **Guarda**: Haz clic en "Guardar turnos" para insertar los bloques WORK en Supabase

### Limitaciones

- **Calidad del OCR**: El OCR puede fallar con imágenes de baja calidad, texto borroso o fuentes muy pequeñas. Siempre revisa los turnos detectados antes de guardar.
- **Formato esperado**: El parser está optimizado para formato Mapal-like con:
  - Fechas en formato `dd/mm` o `dd/mm/yyyy`
  - Rangos de horas en formato `HH:mm - HH:mm`
  - Marcadores de "Día libre" o "Libre"
- **Validaciones**: Los turnos deben cumplir las mismas reglas que los bloques manuales:
  - Fecha dentro del rango de planificación del grupo
  - Fecha no en el pasado
  - Horas válidas (00:00 - 23:59)
- **Turnos que cruzan medianoche**: Se detectan automáticamente y se dividen en 2 bloques al guardar

### Ejemplo de Texto OCR

El parser puede procesar texto como:

```
LUNES 15/01
11:00 - 17:00 COC
MARTES 16/01
Día libre
MIÉRCOLES 17/01
09:00 - 13:00
14:00 - 18:00
```

### Tecnología

- **Tesseract.js**: OCR ejecutado completamente en el navegador (no se suben imágenes al servidor)
- **Parser personalizado**: Lógica en `packages/domain/src/ocr-parse.ts` con tests completos
- **Normalización de errores OCR**: Corrige errores comunes (O→0, I→1, guiones raros, etc.)

### Debug

Si el OCR no detecta turnos correctamente:
1. Revisa el panel "Texto OCR (debug)" para ver el texto crudo extraído
2. Verifica que las fechas y horas están en el formato esperado
3. Intenta mejorar la calidad de la imagen (más contraste, mejor resolución)

## Contribuir

1. Crea una rama desde `main`
2. Implementa cambios
3. Ejecuta tests: `npm run test:domain`
4. Verifica linting
5. Crea PR

## Licencia

MIT

