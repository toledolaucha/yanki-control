# Yanki Control

Aplicación Next.js para gestión de caja con autenticación y base de datos PostgreSQL.

## Variables de entorno

Copia `env.example` como `.env.local` para desarrollo local y completa los valores.

```bash
cp env.example .env.local
```

Variables obligatorias:

- `DATABASE_URL`: conexión a PostgreSQL.
- `NEXTAUTH_SECRET`: secreto usado por NextAuth para firmar tokens/sesiones.
- `NEXTAUTH_URL`: URL base pública de la aplicación.

La app valida estas variables al arrancar y falla de forma explícita si falta alguna.

---

## Local (con Docker DB)

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Levantar PostgreSQL con Docker:

   ```bash
   docker compose up -d db
   ```

3. Crear `.env.local` desde el ejemplo (`env.example`).

   URL recomendada para este `docker-compose.yml`:

   ```env
   DATABASE_URL="postgresql://root:password@localhost:5432/kiosko_db"
   NEXTAUTH_SECRET="tu-secreto-largo-y-aleatorio"
   NEXTAUTH_URL="http://localhost:3000"
   ```

4. Aplicar esquema de Prisma:

   ```bash
   npx prisma migrate deploy
   ```

5. (Opcional) Cargar datos iniciales:

   ```bash
   npx prisma db seed
   ```

6. Ejecutar en desarrollo:

   ```bash
   npm run dev
   ```

---

## Staging

Recomendación: usar un proyecto de Vercel separado para staging y una base de datos independiente.

1. Desplegar desde la rama de staging.
2. Configurar en Vercel las variables de entorno para el entorno **Preview** (y/o **Staging** si lo manejas externo):
   - `DATABASE_URL` (base de staging)
   - `NEXTAUTH_SECRET` (secreto exclusivo de staging)
   - `NEXTAUTH_URL` (URL pública de staging, por ejemplo `https://staging-tuapp.vercel.app`)
3. Ejecutar migraciones contra la base de staging antes o durante el despliegue.

---

## Producción en Vercel

1. Conectar el repositorio en Vercel.
2. En **Project Settings → Environment Variables**, configurar para **Production**:
   - `DATABASE_URL`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL`
3. Verificar que `NEXTAUTH_URL` coincida exactamente con el dominio de producción (por ejemplo `https://app.tudominio.com`).
4. Ejecutar migraciones de Prisma contra la base de producción antes de promover cambios críticos.
5. Desplegar la rama principal.

### Variables en Vercel Project Settings (resumen claro)

En Vercel debes definir **sí o sí** estas tres variables en cada entorno que uses (Preview/Staging/Production):

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

Sin esas variables, la aplicación fallará al iniciar.
