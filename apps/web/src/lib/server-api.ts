import { cookies } from "next/headers";
import { API_URL, ApiError } from "@/lib/api";
import { mockApi } from "@/lib/mock-api";
import { isMockMode, MOCK_COOKIE, parseMockAudience } from "@/lib/mock-mode";

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as {
      message?: string | string[];
    };
    if (Array.isArray(data.message)) return data.message.join(", ");
    if (typeof data.message === "string") return data.message;
  } catch {
    /* ignore */
  }
  return res.statusText || "Permintaan gagal";
}

/** Server Components / Route Handlers: forward browser auth cookies to the API. */
export async function serverApi<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (isMockMode()) {
    const jar = await cookies();
    const audience = parseMockAudience(jar.get(MOCK_COOKIE)?.value);
    return mockApi<T>(path, init, audience);
  }

  const jar = await cookies();
  const cookieHeader = jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (cookieHeader) headers.set("cookie", cookieHeader);

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new ApiError(await parseError(res), res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
