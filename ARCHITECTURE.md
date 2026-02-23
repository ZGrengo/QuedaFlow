# Arquitectura de QuedaFlow

## Principios de Diseño

### 1. Separación de Responsabilidades

```
┌─────────────────┐
│   UI Layer      │  Componentes Angular (presentación)
│  (Components)   │
└────────┬────────┘
         │
┌────────▼────────┐
│  Service Layer  │  Comunicación con Supabase, mapeo de datos
│   (Services)    │
└────────┬────────┘
         │
┌────────▼────────┐
│  Domain Layer   │  Lógica pura, funciones testeables
│  (packages/     │
│    domain)      │
└─────────────────┘
```

### 2. Domain-Driven Design

La lógica de negocio está completamente separada del framework:

- **`packages/domain`**: Funciones puras, sin dependencias de Angular o Supabase
- **Testeable**: Cada función tiene tests unitarios
- **Reutilizable**: Puede usarse en otros proyectos o contextos

### 3. Seguridad por Capas

1. **RLS (Row Level Security)**: Seguridad a nivel de base de datos
2. **Auth Guards**: Protección de rutas en Angular
3. **Validaciones**: Tanto en cliente como en servidor (triggers)

## Flujo de Datos

### Autenticación

```
User → LoginComponent → AuthService → Supabase Auth → Magic Link
                                                          ↓
User clicks link → Supabase → AuthService.authState$ → Router → Protected Routes
```

### Crear Grupo

```
CreateGroupComponent → GroupService.createGroup()
                           ↓
                    Supabase (groups table)
                           ↓
                    Trigger: handle_new_group()
                           ↓
                    Insert into group_members (host)
                           ↓
                    Redirect to /g/:code
```

### Añadir Bloque

```
BlocksManagerComponent → BlocksService.addBlock()
                             ↓
                      Domain: applyBuffer() (si WORK)
                             ↓
                      Domain: splitMidnightBlock() (si cruza medianoche)
                             ↓
                      Supabase (availability_blocks)
                             ↓
                      Trigger: check_preferred_limit()
                             ↓
                      Success/Error
```

### Calcular Slots

```
PlannerViewComponent → PlannerService.getTopSlots()
                            ↓
                     GroupService.getGroup()
                     GroupService.getGroupMembers()
                     BlocksService.getBlocksByGroup()
                     GroupService.getBlockedWindows()
                            ↓
                     Domain: computeSlots()
                            ↓
                     Domain: rankSlots()
                            ↓
                     Display slots
```

## Estructura de Carpetas

### apps/web/

```
src/app/
├── core/                    # Código compartido
│   ├── config/              # Configuración (Supabase)
│   ├── guards/              # Route guards
│   └── services/            # Servicios Angular
│       ├── auth.service.ts
│       ├── group.service.ts
│       ├── blocks.service.ts
│       └── planner.service.ts
│
└── features/                # Features por módulo
    ├── auth/
    │   └── login/
    ├── group/
    │   ├── create-group/
    │   ├── join-group/
    │   └── group-detail/
    ├── blocks/
    │   └── blocks-manager/
    ├── planner/
    │   └── planner-view/
    └── ocr/                 # (Placeholder)
```

### packages/domain/

```
src/
├── time.ts                  # Utilidades de tiempo
├── blocks.ts                # Manipulación de bloques
├── compute.ts               # Cálculo de slots
└── types.ts                 # Interfaces TypeScript
```

## Modelo de Datos

### Relaciones

```
auth.users (Supabase)
    ↓
profiles (1:1)
    ↓
group_members (N:M)
    ↓
groups (1:N)
    ├── group_blocked_windows (1:N)
    └── availability_blocks (1:N)
```

### Tablas Clave

**groups**
- Configuración del grupo
- Código único para unirse
- Settings (buffer, threshold, target_people)

**group_members**
- Relación usuarios-grupos
- Roles: host/member
- RLS: usuarios ven solo miembros de sus grupos

**availability_blocks**
- Bloques de ocupación por usuario (indican cuándo NO está disponible)
- WORK: horas de trabajo (ocupado). Futuro: importación desde imágenes de horarios
- UNAVAILABLE: otros momentos ocupados (reuniones, citas, etc.)
- PREFERRED: horas libres que el usuario prefiere para quedar
- Validación: máx 3 PREFERRED por usuario/grupo

**group_blocked_windows**
- Ventanas bloqueadas (ej: 00:00-07:59)
- Puede ser por día de semana o todos los días
- Solo host puede modificar

## RLS Policies

### Principio: "Deny by Default"

Todas las tablas tienen RLS habilitado. Sin policies explícitas, nadie puede acceder.

### Policies por Tabla

1. **profiles**: Usuario ve/modifica solo su perfil
2. **groups**: Usuario ve grupos donde es miembro
3. **group_members**: Usuario ve miembros de sus grupos
4. **availability_blocks**: Usuario inserta/modifica solo sus bloques
5. **group_blocked_windows**: Solo host puede gestionar

### Uso de auth.uid()

Todas las policies usan `auth.uid()` para identificar al usuario actual. Esto garantiza que:
- No se puede falsificar la identidad
- La seguridad está en la base de datos, no solo en el cliente

## Decisiones Técnicas

### Angular Standalone

**Decisión**: Usar standalone components (Angular 17+)

**Razón**:
- Menos boilerplate
- Mejor tree-shaking
- Más fácil de mantener
- Futuro de Angular

### RxJS vs Signals

**Decisión**: RxJS para esta versión

**Razón**:
- Supabase client usa Observables
- Integración más natural
- Comunidad más grande
- Más maduro

**Futuro**: Considerar Signals cuando Supabase lo soporte mejor

### Domain Package Separado

**Decisión**: Package independiente con TypeScript puro

**Razón**:
- Lógica testeable sin framework
- Tests más rápidos
- Reutilizable
- Fácil de mantener

### RLS en Supabase

**Decisión**: Seguridad a nivel de base de datos

**Razón**:
- Imposible bypassear desde el cliente
- Menos código de validación
- Más seguro por defecto
- Escalable

## Testing Strategy

### Domain Package

- **Tests unitarios** para cada función
- **Vitest** como test runner
- **Coverage** objetivo: >80%

### Angular App

- **Tests E2E** (pendiente)
- **Tests de componentes** (pendiente)
- **Tests de servicios** (pendiente)

## Escalabilidad

### Actual (MVP)

- Monorepo simple
- Una app Angular
- Un domain package
- Supabase como backend

### Futuro

- **Microservicios**: Si es necesario, domain package puede convertirse en servicio
- **Caché**: Redis para slots calculados
- **Queue**: Para procesamiento asíncrono (emails, OCR)
- **CDN**: Para assets estáticos

## Performance

### Optimizaciones Actuales

- Lazy loading de rutas
- Standalone components (mejor tree-shaking)
- Indexes en tablas SQL

### Optimizaciones Futuras

- Caché de slots calculados
- Paginación de resultados
- Virtual scrolling para listas grandes
- Service Workers para offline

## Seguridad

### Capas de Seguridad

1. **RLS**: Base de datos
2. **Auth Guards**: Angular
3. **Validaciones**: Cliente y servidor
4. **HTTPS**: En producción
5. **CORS**: Configurado en Supabase

### Buenas Prácticas

- Nunca exponer service_role key en el cliente
- Validar datos en servidor (triggers)
- Usar prepared statements (Supabase lo hace automáticamente)
- Rate limiting (configurar en Supabase)

## Monitoreo

### Actual

- Console logs
- Supabase logs

### Futuro

- Error tracking (Sentry)
- Analytics (PostHog/Mixpanel)
- Performance monitoring
- User feedback

