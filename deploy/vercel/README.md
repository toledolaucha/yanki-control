# Deploy en Vercel

## Variables necesarias

Configurar en Project Settings → Environment Variables:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require"
NEXTAUTH_SECRET="secreto-largo-y-unico"
NEXTAUTH_URL="https://<tu-dominio>.vercel.app"
NODE_ENV="production"
```

## Comandos de build/start

Vercel ejecuta automáticamente:

```bash
npm install
npm run build
```

Para probar localmente el flujo de Vercel:

```bash
npm run build
npm run start
```

## Estrategia de migración

- No correr `migrate dev` en Vercel.
- Ejecutar en CI/CD o local contra producción:

```bash
npx prisma migrate deploy
```

- Usar branch database o entorno staging para validar migraciones antes de producción.
- Mantener backups y habilitar point-in-time recovery en el proveedor PostgreSQL.
