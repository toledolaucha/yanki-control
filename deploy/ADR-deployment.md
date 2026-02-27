# ADR: estrategia de deployment (Postgres cloud + Vercel)

- **Estado:** Aprobado
- **Fecha:** 2026-02-27
- **Decisión:** Usar **Vercel** para hospedar la aplicación Next.js y **PostgreSQL administrado en la nube** como base de datos principal.

## Contexto

El proyecto necesita:

- Deploy rápido del frontend/backend de Next.js con mínimo mantenimiento operativo.
- Escalar automáticamente ante picos de tráfico sin gestionar infraestructura propia.
- Contar con una base de datos transaccional con backups, alta disponibilidad y seguridad gestionada.
- Mantener un flujo de releases predecible con migraciones controladas de Prisma.

## Decisión

Se adopta la siguiente arquitectura objetivo:

1. **Runtime de aplicación en Vercel** (build y despliegues automáticos por branch).
2. **Base de datos PostgreSQL cloud** (Neon, Supabase, RDS u otro proveedor equivalente).
3. **Migraciones Prisma** ejecutadas por pipeline (`prisma migrate deploy`) fuera del runtime de Vercel.

## Justificación

### Por qué Vercel

- Integración nativa con Next.js (App Router, optimizaciones y routing).
- Time-to-deploy bajo para equipo pequeño.
- Entornos Preview/Production simples para validar cambios antes de merge.

### Por qué Postgres cloud

- Mejor ajuste para cargas concurrentes y crecimiento que una base local embebida.
- Soporte de backups, réplicas y recuperación ante incidentes.
- Conexión segura por TLS y operación 24/7 administrada por proveedor.

### Por qué la combinación

- Reduce carga operativa (no self-hosting del stack completo).
- Separa responsabilidades: app stateless en Vercel + datos persistentes en PostgreSQL.
- Facilita estrategia de migraciones formal y auditable.

## Consecuencias

### Positivas

- Menor overhead de infraestructura.
- Mejor disponibilidad y escalabilidad.
- Flujo de entrega continua más simple.

### Negativas / trade-offs

- Dependencia de proveedores externos (costos y lock-in parcial).
- Necesidad de cuidar límites de conexiones y cold starts.
- Requiere manejo prolijo de secretos y variables por ambiente.

## Plan de implementación

1. Definir `DATABASE_URL` de PostgreSQL cloud en todos los entornos.
2. Ajustar Prisma para apuntar a PostgreSQL en producción.
3. Implementar pipeline de migración (`prisma migrate deploy`) previo al deploy de app.
4. Ejecutar validación en staging con copia de datos/anónimos.
5. Publicar en producción con monitoreo y rollback operativo documentado.
