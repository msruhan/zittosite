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

/** Browsers drop Secure cookies on plain-HTTP origins, so only mark them Secure behind HTTPS. */
export function secureCookies(): boolean {
  return isProduction() && webPublicUrl().startsWith("https://");
}

export function corsOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS ?? process.env.WEB_PUBLIC_URL ?? "http://localhost:3000";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function paymentSimulationEnabled(): boolean {
  return process.env.PAYMENT_SIMULATION === "1";
}

const PLACEHOLDER_SECRET = /change-me|changeme|example|placeholder/i;

/**
 * Production hardening is enforced once the site runs on HTTPS. Plain-HTTP
 * deployments (IP-only, before a domain exists) only get warnings so an
 * existing server keeps running while it is being migrated.
 */
export function validateStartupEnv(warn: (message: string) => void) {
  const secrets = {
    USER_JWT_SECRET: getUserJwtSecret(),
    ADMIN_JWT_SECRET: getAdminJwtSecret(),
  };
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set");
  }
  if (!isProduction()) return;

  const problems: string[] = [];
  for (const [name, value] of Object.entries(secrets)) {
    if (PLACEHOLDER_SECRET.test(value)) {
      problems.push(`${name} still uses a placeholder value`);
    }
  }
  if (secrets.USER_JWT_SECRET === secrets.ADMIN_JWT_SECRET) {
    problems.push("USER_JWT_SECRET and ADMIN_JWT_SECRET must differ");
  }

  if (paymentSimulationEnabled()) {
    warn("PAYMENT_SIMULATION=1: customers can mark orders paid without a gateway");
  }

  if (!webPublicUrl().startsWith("https://")) {
    warn("WEB_PUBLIC_URL is not https:// — running in plain-HTTP compatibility mode");
    for (const problem of problems) warn(`INSECURE: ${problem}`);
    return;
  }
  if (problems.length) throw new Error(problems.join("; "));
}
