# Guía de Setup - QuedaFlow

## Paso 1: Instalación de Dependencias

```bash
# Desde la raíz del proyecto
npm install

# Instalar dependencias del domain package
cd packages/domain
npm install

# Instalar dependencias de la app web
cd ../../apps/web
npm install
```

## Paso 2: Configurar Supabase

### 2.1 Crear Proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta
2. Crea un nuevo proyecto
3. Espera a que se complete el setup (puede tardar 2-3 minutos)

### 2.2 Obtener Credenciales

En el dashboard de Supabase:
1. Ve a **Settings** > **API**
2. Copia:
   - **Project URL** (ej: `https://xxxxx.supabase.co`)
   - **anon/public key** (la clave pública)

### 2.3 Ejecutar Migraciones

**Opción A: Desde Supabase Dashboard (Recomendado para empezar)**

1. Ve a **SQL Editor** en el dashboard
2. Ejecuta cada migración en orden:
   - Copia y pega el contenido de `supabase/migrations/001_initial_schema.sql`
   - Haz clic en **Run**
   - Repite con `002_rls_policies.sql`
   - Repite con `003_functions_and_triggers.sql`

**Opción B: Usando Supabase CLI**

```bash
# Instalar Supabase CLI (si no lo tienes)
npm install -g supabase

# Login
supabase login

# Link al proyecto
supabase link --project-ref your-project-ref

# Ejecutar migraciones
supabase db push
```

### 2.4 Configurar Authentication

1. Ve a **Authentication** > **Providers**
2. Habilita **Email** provider
3. Ve a **URL Configuration**
4. Añade a **Redirect URLs**:
   - `http://localhost:4200/**`
   - `http://localhost:4200/dashboard` (aquí llega el usuario al hacer clic en el magic link)
   - `http://localhost:4200/login`
   - Tu dominio de producción (cuando lo tengas)

## Paso 3: Configurar Variables de Entorno

### Opción A: Usar script automático (Recomendado)

1. Crea un archivo `.env` en `apps/web/`:

```env
NG_APP_SUPABASE_URL=https://xxxxx.supabase.co
NG_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

2. Ejecuta el script para generar el archivo de entorno:

```bash
cd apps/web
npm run set-env
```

El script leerá tu `.env` y actualizará `src/environments/environment.ts` automáticamente.

**Nota**: El script se ejecuta automáticamente antes de `npm start` gracias al hook `prestart`.

### Opción B: Editar manualmente

Si prefieres, puedes editar directamente `apps/web/src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  supabaseUrl: 'https://xxxxx.supabase.co',
  supabaseAnonKey: 'tu_anon_key_aqui'
};
```

## Paso 4: Ejecutar la Aplicación

```bash
# Desde la raíz del proyecto
npm run dev:web

# O desde apps/web
cd apps/web
npm start
```

La aplicación estará disponible en `http://localhost:4200`

## Paso 5: Verificar que Todo Funciona

1. **Login**: Ve a `http://localhost:4200/login`
2. **Ingresa tu email**: Recibirás un magic link
3. **Crea un grupo**: Después de login, crea tu primer grupo
4. **Añade bloques**: Ve a "Gestionar Bloques" y añade algunos bloques
5. **Ver planner**: Ve a "Ver Planner" para ver los huecos calculados

## Troubleshooting

### Warnings de npm install

Es normal ver warnings sobre paquetes deprecados al ejecutar `npm install`. Estos vienen de dependencias transitivas (dependencias de dependencias) y no afectan la funcionalidad. Ver `SECURITY.md` para más detalles.

**Puedes continuar con el setup normalmente.**

### Error: "Missing Supabase environment variables"

- Verifica que el archivo `.env` existe en `apps/web/`
- Verifica que las variables empiezan con `NG_APP_`
- Reinicia el servidor de desarrollo

### Error: "RLS policy violation"

- Verifica que ejecutaste todas las migraciones
- Verifica que estás autenticado
- Verifica que perteneces al grupo que intentas acceder

### Error: "Maximum 3 PREFERRED blocks"

- Es una validación intencional
- Elimina un bloque PREFERRED existente antes de añadir uno nuevo

### Magic link no llega

- Revisa la carpeta de spam
- Verifica que el email está correcto
- En desarrollo local, puedes usar [Inbucket](https://inbucket.app/) si usas Supabase CLI local

### Error al crear grupo

- Verifica que la función `generate_group_code()` existe en Supabase
- Verifica que tienes permisos para insertar en la tabla `groups`

## Próximos Pasos

Una vez que tengas todo funcionando:

1. **Explora el código**: Revisa la estructura del proyecto
2. **Ejecuta tests**: `cd packages/domain && npm test`
3. **Personaliza**: Ajusta estilos, colores, textos según necesites
4. **Deploy**: Cuando estés listo, configura Cloudflare Pages

## Estructura del Proyecto

```
quedaflow/
├── apps/web/              # Angular app
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/      # Servicios, guards, config
│   │   │   └── features/  # Componentes por feature
│   │   └── environments/  # Variables de entorno
│   └── .env               # (crear este archivo)
├── packages/domain/       # Lógica de dominio
│   └── src/               # Código fuente y tests
└── supabase/
    └── migrations/        # Migraciones SQL
```

## Comandos Útiles

```bash
# Desarrollo
npm run dev:web              # Iniciar app Angular
npm run build:web            # Build de producción

# Tests
npm run test:domain          # Ejecutar tests del domain package
npm run test:watch          # Tests en modo watch

# Desde packages/domain
npm test                     # Ejecutar tests
npm run test:coverage       # Tests con coverage
npm run build               # Build del package
```

## Recursos

- [Angular Docs](https://angular.io/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Angular Material](https://material.angular.io/)
- [RxJS Docs](https://rxjs.dev/)

