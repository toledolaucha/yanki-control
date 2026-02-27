# Yanki Control

Aplicación Next.js para gestión operativa (caja, turnos, productos y auditoría).

## Desarrollo rápido

```bash
npm install
npm run docker:up
npm run dev
```

La app queda disponible en `http://localhost:3000`.

## Estructura de deployment

- `deploy/local/README.md`: guía para desarrollo local con Docker + PostgreSQL.
- `deploy/vercel/README.md`: referencia para despliegue en Vercel.
- `deploy/selfhost/README.md`: referencia para despliegue self-hosted.
- `deploy/ADR-deployment.md`: decisión técnica de arquitectura de despliegue.

## Docker Compose

- El archivo principal para la base local está en `deploy/local/docker-compose.yml`.
- Se mantiene un `docker-compose.yml` mínimo en raíz que referencia ese archivo.

## Scripts útiles

```bash
npm run docker:up     # levantar servicios de compose
npm run docker:down   # bajar servicios de compose
npm run build         # build de producción
npm run start         # start de producción
```
