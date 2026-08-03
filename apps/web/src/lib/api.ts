import {
  clearMockCookieValue,
  isMockMode,
  mockCookieValue,
  parseMockAudience,
  type MockAudience,
} from "@/lib/mock-mode";
import { mockApi } from "@/lib/mock-api";
import { ApiError } from "@/lib/api-error";

export { ApiError } from "@/lib/api-error";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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

function readClientMockAudience(): MockAudience | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("zitto_mock="));
  return parseMockAudience(match?.split("=")[1]);
}

function applyClientMockSession(path: string, method: string) {
  if (typeof document === "undefined") return;
  if (method === "POST" && path === "/auth/login") {
    document.cookie = mockCookieValue("user");
  }
  if (method === "POST" && path === "/admin/auth/login") {
    document.cookie = mockCookieValue("admin");
  }
  if (
    method === "POST" &&
    (path === "/auth/logout" || path === "/admin/auth/logout")
  ) {
    document.cookie = clearMockCookieValue();
  }
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (isMockMode()) {
    const cleanPath = path.split("?")[0] ?? path;
    const method = (init.method ?? "GET").toUpperCase();
    applyClientMockSession(cleanPath, method);
    return mockApi<T>(path, init, readClientMockAudience());
  }

  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    throw new ApiError(await parseError(res), res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
