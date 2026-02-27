# Yanki Control

## Overview funcional
Yanki Control es una aplicación web para la operación diaria de caja y gestión interna de un comercio.

Permite:
- Autenticación de usuarios con roles (`ADMIN` y `EMPLEADO`).
- Apertura y cierre de turnos.
- Registro de ingresos/egresos y transferencias entre contenedores de dinero.
- Visualización de métricas en dashboard (ventas, egresos, balances y alertas).
- Gestión de entidades clave como productos, categorías, usuarios y reportes.
- Auditoría de operaciones para trazabilidad.

## Arquitectura
La base de la app está montada sobre:

- **Next.js (App Router)** para UI y rutas server/client.
- **NextAuth** para autenticación y sesiones.
- **Prisma ORM** como capa de acceso a datos.
- **PostgreSQL** como base de datos recomendada para producción (especialmente en serverless/Vercel).

Flujo general:
1. El usuario inicia sesión por credenciales en NextAuth.
2. NextAuth valida credenciales contra usuarios almacenados (vía Prisma).
3. Las acciones de dashboard se ejecutan en servidor y consultan/escriben en DB.
4. Prisma materializa operaciones SQL en PostgreSQL.

> Nota: si hoy estás desarrollando con SQLite o un motor alternativo, para deploy productivo en Vercel se recomienda migrar a PostgreSQL.

## Requisitos
- **Node.js 20+**
- **npm 10+** (o equivalente)
- **Base PostgreSQL** accesible (local o cloud)
- Variables de entorno configuradas

Variables mínimas recomendadas:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DBNAME?schema=public"
NEXTAUTH_SECRET="una-clave-larga-y-segura"
NEXTAUTH_URL="http://localhost:3000"
```

## Setup local paso a paso
1. **Clonar repositorio**
   ```bash
   git clone <tu-repo>
   cd yanki-control
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar entorno**
   - Crear archivo `.env` en la raíz.
   - Cargar las variables necesarias (`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`).

4. **Generar cliente de Prisma**
   ```bash
   npx prisma generate
   ```

5. **Aplicar esquema en DB (desarrollo)**
   ```bash
   npx prisma db push
   ```

6. **Ejecutar seed inicial**
   ```bash
   npx prisma db seed
   ```

7. **Levantar app**
   ```bash
   npm run dev
   ```

8. **Abrir en navegador**
   - `http://localhost:3000`

## Migraciones y seed
### Crear migración (cuando hay cambios de schema)
```bash
npx prisma migrate dev --name <descripcion_cambio>
```

### Aplicar migraciones en entornos no dev (staging/prod)
```bash
npx prisma migrate deploy
```

### Seed de datos
Este proyecto incluye scripts de seed en `prisma/`.

- Seed principal (usuario admin inicial):
  ```bash
  npx prisma db seed
  ```

- Seed opcional de categorías (si aplica al entorno):
  ```bash
  node prisma/seed-categories.js
  ```

> Si no existen migraciones versionadas todavía, generá la primera con `prisma migrate dev` antes de depender de `migrate deploy` en CI/CD.

## Deploy en Vercel paso a paso
1. **Preparar PostgreSQL productivo**
   - Crear base (Neon, Supabase, RDS, etc.).
   - Obtener `DATABASE_URL`.

2. **Subir repo a GitHub/GitLab/Bitbucket**
   - Confirmar que `README`, código y `prisma/schema.prisma` estén versionados.

3. **Crear proyecto en Vercel**
   - Importar repositorio.
   - Framework detectado: Next.js.

4. **Configurar variables de entorno en Vercel**
   - `DATABASE_URL`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` (URL final de Vercel, por ejemplo `https://tuapp.vercel.app`)

5. **Configurar comando de build (si hace falta)**
   - Asegurar generación del cliente Prisma durante build.
   - Recomendado en pipeline: `prisma generate` antes de `next build`.

6. **Ejecutar migraciones en producción**
   - Desde CI/CD o job manual: `npx prisma migrate deploy`

7. **Deploy**
   - Ejecutar primer deploy desde Vercel.
   - Verificar logs de build y runtime.

8. **Validar aplicación en URL pública**
   - Probar login y navegación principal.

## Checklist post-deploy
- [ ] Login funciona (credenciales válidas/invalidas, redirección correcta).
- [ ] Acciones de dashboard funcionan (crear/consultar operaciones, métricas y listados).
- [ ] Conexión a DB establecida (sin errores de Prisma en runtime).
- [ ] Callbacks de auth correctos (JWT/session contienen `id` y `role`, autorización por rol operativa).

## Troubleshooting (Prisma + NextAuth en serverless)
### 1) `PrismaClientInitializationError` / timeouts de conexión
**Síntomas**
- Errores intermitentes en funciones serverless.
- Fallos al resolver queries en horas pico.

**Causas frecuentes**
- Pool de conexiones no preparado para serverless.
- `DATABASE_URL` incorrecta o sin parámetros recomendados por proveedor.

**Qué hacer**
- Verificar string de conexión y credenciales.
- Usar proveedor con pooling compatible serverless (o modo pooler).
- Evitar crear múltiples instancias de Prisma por request.

### 2) `Prisma Client is unable to run in this browser environment`
**Causa**
- Import de Prisma en componente cliente.

**Qué hacer**
- Mantener Prisma sólo en código server (`route handlers`, `server actions`, utilidades server).

### 3) `NEXTAUTH_URL` incorrecta (redirects rotos)
**Síntomas**
- Login exitoso pero redirecciones erróneas o callback URL inválida.

**Qué hacer**
- En local: `NEXTAUTH_URL=http://localhost:3000`
- En producción: URL pública exacta de Vercel (`https://...vercel.app` o dominio custom).

### 4) `NEXTAUTH_SECRET` ausente o inconsistente
**Síntomas**
- Sesiones que se invalidan inesperadamente.
- JWT inválido entre despliegues.

**Qué hacer**
- Definir un `NEXTAUTH_SECRET` único y estable por entorno.
- No regenerarlo en cada deploy si querés mantener sesiones activas.

### 5) Callbacks JWT/session no propagan campos custom
**Síntomas**
- `session.user.role` o `session.user.id` llega `undefined`.

**Qué hacer**
- Revisar callbacks `jwt` y `session` de NextAuth.
- Confirmar que el objeto `user` inicial incluye `id` y `role`.
- Validar tipados extendidos de NextAuth si usás TypeScript.

### 6) Cambios de schema no reflejados en producción
**Síntomas**
- Columnas/tablas faltantes luego de deploy.

**Qué hacer**
- Correr `npx prisma migrate deploy` en cada release.
- Confirmar que las migraciones estén commiteadas en el repositorio.

---
Si querés, el siguiente paso recomendado es agregar un script de deploy/CI que automatice `prisma generate` + `prisma migrate deploy` + `next build` para reducir errores manuales.
