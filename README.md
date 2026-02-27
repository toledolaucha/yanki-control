# Yanki Control (Next.js + Prisma + NextAuth)

Aplicación de control de caja/turnos para kiosko.

## Cambios recomendados para producción (aplicados)

- Base de datos estandarizada en **PostgreSQL** (antes el schema de Prisma estaba en SQLite y el compose en Postgres).
- `docker-compose.yml` con servicios `db` + `app` para levantar todo con un solo comando.
- `Dockerfile` multi-stage para build y runtime de producción.
- Seed de Prisma en JavaScript (`prisma/seed.js`) para evitar dependencia implícita de `ts-node`.
- `.env.example` con variables mínimas necesarias.

## Variables de entorno

Copiar `.env.example` a `.env` y completar valores reales:

```bash
cp .env.example .env
```

Variables mínimas:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

## Desarrollo local

1. Levantar PostgreSQL:
   ```bash
   docker compose up -d db
   ```
2. Instalar dependencias:
   ```bash
   npm ci
   ```
3. Preparar base:
   ```bash
   npm run db:generate
   npm run db:push
   npm run db:seed
   ```
4. Ejecutar app:
   ```bash
   npm run dev
   ```

## Producción fácil (Docker Compose)

> Recomendado para deploy rápido sin romper consistencia de entorno.

1. Configurar secretos reales en `.env`.
2. Levantar servicios:

```bash
docker compose up -d --build
```

Esto arranca:
- PostgreSQL (`db`)
- Next.js (`app`) en `http://localhost:3000`

## Scripts útiles

- `npm run build`: build de Next.js
- `npm run start`: arranque producción
- `npm run db:generate`: genera cliente Prisma
- `npm run db:push`: sincroniza schema (entornos simples)
- `npm run db:migrate`: aplica migraciones de producción
- `npm run db:seed`: ejecuta seed

## Usuario inicial (seed)

- Email: `admin@yanki.com.ar`
- Password: `theyanki`

> Cambiar credenciales y rotar secretos antes de exponer en internet.
