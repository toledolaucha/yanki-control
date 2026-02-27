# Yanki Control

Aplicación Next.js con Prisma y PostgreSQL.

## Scripts útiles

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run prisma:generate
npm run prisma:migrate:deploy
```

### Comando de build recomendado para Vercel

Usar este comando en **Build Command**:

```bash
prisma generate && next build
```

> Este comando ya está configurado en `npm run build`.

## Estrategia de migraciones

- **Producción**: ejecutar `prisma migrate deploy`.
- **Desarrollo**: usar `prisma migrate dev`.

## Deploy en Vercel

### Primer deploy (proyecto nuevo)

1. Configurar variables de entorno en Vercel (al menos `DATABASE_URL` y las requeridas por auth).
2. Confirmar que el **Build Command** sea:

   ```bash
   prisma generate && next build
   ```

3. Realizar el deploy inicial.
4. Luego del primer deploy, aplicar migraciones en base de datos de producción:

   ```bash
   npm run prisma:migrate:deploy
   ```

5. (Opcional recomendado) Regenerar cliente local tras cambios de schema:

   ```bash
   npm run prisma:generate
   ```

### Redeploy (nuevas versiones)

1. Si hubo cambios en `prisma/schema.prisma` con migraciones nuevas, aplicarlas en producción:

   ```bash
   npm run prisma:migrate:deploy
   ```

2. Hacer redeploy desde Vercel (o push a la rama conectada).
3. Verificar logs de build y runtime.

## Flujo de desarrollo local

1. Crear una migración y aplicarla localmente:

   ```bash
   npx prisma migrate dev --name <nombre-migracion>
   ```

2. Levantar la app:

   ```bash
   npm run dev
   ```
