# Deploy self-hosted (VM o Kubernetes)

## Variables necesarias

```env
DATABASE_URL="postgresql://USER:PASSWORD@POSTGRES-HOST:5432/DB?schema=public"
NEXTAUTH_SECRET="secreto-largo-y-unico"
NEXTAUTH_URL="https://app.tudominio.com"
NODE_ENV="production"
PORT="3000"
```

## Comandos de build/start

En una VM (Node.js + process manager):

```bash
npm ci
npm run build
npx prisma migrate deploy
npm run start
```

Con contenedor (ejemplo):

```bash
docker build -t kiosko-caja .
docker run -p 3000:3000 --env-file .env kiosko-caja
```

## Estrategia de migración

- Pipeline recomendado:
  1. Backup de base de datos.
  2. `npx prisma migrate deploy`.
  3. Health check de la aplicación.
  4. Deploy del nuevo release.
- Evitar cambios destructivos sin migración reversible o ventana de mantenimiento.
- Registrar versión de app y versión de migración aplicada para rollback operativo.
