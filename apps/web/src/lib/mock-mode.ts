export const MOCK_COOKIE = "zitto_mock";

export type MockAudience = "user" | "admin";

export function isMockMode(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCK === "1";
}

export function parseMockAudience(
  value: string | undefined | null,
): MockAudience | null {
  if (value === "user" || value === "admin") return value;
  return null;
}

export function mockCookieValue(audience: MockAudience): string {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:";
  const parts = [
    `${MOCK_COOKIE}=${audience}`,
    "Path=/",
    "Max-Age=604800",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearMockCookieValue(): string {
  return `${MOCK_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
