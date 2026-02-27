# Yanki Control (Next.js + Prisma + NextAuth)

Aplicación de control de caja/turnos para kiosko.

## Hardening aplicado para deploy estable

- Prisma alineado con **PostgreSQL**.
- `Dockerfile` multi-stage con runtime como **usuario no-root**.
- `entrypoint` robusto que valida variables críticas y corre migraciones al inicio.
- Seed desacoplado del arranque normal (`RUN_DB_SEED=true` solo cuando se necesite).
- `docker-compose.yml` con `db` + `app`, healthcheck en DB y healthcheck en app (`/api/health`).
- `.dockerignore` para builds más limpios y reproducibles.

## Variables de entorno

Copiar `.env.example` a `.env` y completar secretos reales:

```bash
cp .env.example .env
```

Variables obligatorias:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

Opcionales útiles:

- `RUN_DB_SEED=false` (poner `true` solo para bootstrap inicial)
- `PORT=3000`

## Desarrollo local

1. Levantar PostgreSQL:
   ```bash
   docker compose up -d db
   ```
2. Instalar dependencias:
   ```bash
   npm ci
   ```
3. Preparar base (local/dev):
   ```bash
   npm run db:generate
   npm run db:push
   npm run db:seed
   ```
4. Ejecutar app:
   ```bash
   npm run dev
   ```

## Producción hoy (pasos recomendados)

1. Configurar `.env` con secretos reales.
2. Build y arranque:
   ```bash
   docker compose up -d --build
   ```
3. Bootstrap inicial (solo primera vez):
   ```bash
   RUN_DB_SEED=true docker compose up -d app
   ```
   Luego volver a `RUN_DB_SEED=false`.

## Migraciones (regla de oro)

- **Producción:** usar `npm run db:migrate` (`prisma migrate deploy`).
- **Desarrollo rápido/local:** `npm run db:push`.

## Scripts útiles

- `npm run build`: build de Next.js
- `npm run start`: arranque producción
- `npm run db:generate`: genera cliente Prisma
- `npm run db:push`: sincroniza schema (solo local/dev)
- `npm run db:migrate`: aplica migraciones de producción
- `npm run db:seed`: ejecuta seed manual

## Healthcheck

- Endpoint: `GET /api/health`
- Respuesta esperada: `200 { "status": "ok" }`

## Usuario inicial (seed)

- Email: `admin@yanki.com.ar`
- Password: `theyanki`

> Cambiar contraseña y rotar secretos antes de exponer en internet.


## Deploy en VPS DonWeb

Para ir directo a producción en tu VPS Linux de DonWeb, seguí la guía:

- `docs/DEPLOY_DONWEB.md`

También podés usar el script:

```bash
./scripts/deploy-prod.sh
```
