import 'server-only';

const requiredEnvVars = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL'] as const;

type RequiredEnvVar = (typeof requiredEnvVars)[number];

type Env = Record<RequiredEnvVar, string>;

const missingVars = requiredEnvVars.filter((key) => {
  const value = process.env[key];
  return typeof value !== 'string' || value.trim().length === 0;
});

if (missingVars.length > 0) {
  throw new Error(
    `[env] Faltan variables de entorno obligatorias: ${missingVars.join(', ')}. ` +
      'Defínelas en tu entorno (por ejemplo, .env.local o Vercel Project Settings).',
  );
}

export const env: Env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET!,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL!,
};
