export function getUserJwtSecret(): string {
  const secret = process.env.USER_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("USER_JWT_SECRET must be set (min 32 chars)");
  }
  return secret;
}

export function getAdminJwtSecret(): string {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_JWT_SECRET must be set (min 32 chars)");
  }
  return secret;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function webPublicUrl(): string {
  return (process.env.WEB_PUBLIC_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function corsOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS ?? process.env.WEB_PUBLIC_URL ?? "http://localhost:3000";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function validateStartupEnv() {
  getUserJwtSecret();
  getAdminJwtSecret();
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set");
  }
}
