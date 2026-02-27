# Yanki Control

Aplicación Next.js para gestión de caja/turnos con Prisma y PostgreSQL.

## Requisitos

- Node.js 20+
- Docker (opcional para desarrollo local)

## Variables de entorno

Copiá el archivo de ejemplo y completá valores reales:

```bash
cp env.example .env
```

Variables mínimas:

- `DATABASE_URL`: conexión de runtime usada por la app y Prisma Client.
- `DIRECT_URL` (opcional): conexión directa para migraciones/comandos Prisma.
- `NEXTAUTH_SECRET`: secreto de NextAuth.
- `NEXTAUTH_URL`: URL base de la app (ejemplo: `http://localhost:3000`).

## Base de datos (PostgreSQL)

El proyecto está configurado con Prisma usando `provider = "postgresql"`.

### Desarrollo local con Docker Compose

```bash
docker compose up -d db
```

Si querés levantar app + base:

```bash
docker compose up -d
```

`docker-compose.yml` usa las mismas variables que cloud (`DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`) para mantener paridad entre entornos.

## Prisma

Comandos típicos:

```bash
npx prisma generate
npx prisma migrate dev
```

> `DIRECT_URL` se usa para migraciones cuando está disponible; si no, Prisma utiliza `DATABASE_URL`.

## Deploy en Vercel

Proveedor recomendado de PostgreSQL administrado (cualquiera de estos):

- Neon
- Supabase
- Railway
- Render PostgreSQL

### Pasos sugeridos

1. Crear una base PostgreSQL en tu proveedor elegido.
2. Copiar la cadena de conexión principal en `DATABASE_URL`.
3. (Opcional) Copiar una conexión directa/no pooler en `DIRECT_URL` para migraciones.
4. En Vercel: **Project → Settings → Environment Variables**.
5. Cargar:
   - `DATABASE_URL`
   - `DIRECT_URL` (opcional)
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` (por ejemplo el dominio de producción)
6. Redeploy del proyecto.

## Desarrollo

```bash
npm install
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).
