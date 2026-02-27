# Deploy local (desarrollo)

## Variables necesarias

Crear `.env` en la raíz del proyecto con:

```env
DATABASE_URL="postgresql://root:password@localhost:5432/kiosko_db?schema=public"
NEXTAUTH_SECRET="reemplazar-por-un-secreto-largo"
NEXTAUTH_URL="http://localhost:3000"
NODE_ENV="development"
```

## Comandos de build/start

```bash
# levantar base local
npm run docker:up

# aplicar migraciones/primer esquema
npx prisma migrate dev

# correr app
npm run dev
```

Si querés emular producción:

```bash
npm run build
npm run start
```

## Estrategia de migración

- Desarrollo: `prisma migrate dev` para generar y aplicar migraciones iterativas.
- Versionado: commitear siempre la carpeta `prisma/migrations`.
- Seed inicial (opcional): `npx prisma db seed`.
- Antes de deploy: validar estado con `npx prisma migrate status`.
