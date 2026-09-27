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

/**
 * The web server reads auth cookies on its own host (e.g. zittosite.com) while the
 * API sets them from api.zittosite.com, so they must be scoped to the shared parent.
 * COOKIE_DOMAIN overrides; otherwise it is derived from WEB_PUBLIC_URL behind HTTPS.
 */
export function cookieDomain(): string | undefined {
  const explicit = process.env.COOKIE_DOMAIN?.trim();
  if (explicit) return explicit;
  if (!secureCookies()) return undefined;
  const host = new URL(webPublicUrl()).hostname;
  if (host === "localhost" || /^[\d.]+$/.test(host) || host.includes(":")) {
    return undefined;
  }
  return host.replace(/^www\./, "");
}

export function corsOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS ?? process.env.WEB_PUBLIC_URL ?? "http://localhost:3000";
  const origins = raw
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
  // The site answers on both apex and www, so allow each origin's counterpart.
  const counterparts = origins
    .filter((origin) => origin.startsWith("https://"))
    .map((origin) =>
      origin.startsWith("https://www.")
        ? origin.replace("https://www.", "https://")
        : origin.replace("https://", "https://www."),
    );
  return [...new Set([...origins, ...counterparts])];
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
