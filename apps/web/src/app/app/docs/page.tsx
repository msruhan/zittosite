import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ApiDocs } from "@/components/domain/api-docs/api-docs";
import { API_URL, ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import type { User } from "@/lib/types";

export const metadata: Metadata = {
  title: "API Docs",
};

export default async function ApiDocsPage() {
  let user: User;
  try {
    user = await serverApi<User>("/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  const username = user.apiEnabled
    ? (await serverApi<{ username: string }>("/api-keys").catch(() => null))?.username ?? user.username
    : user.username;
  const endpoint = `${API_URL.replace(/\/$/, "")}/api/index.php`;

  return <ApiDocs endpoint={endpoint} username={username} apiEnabled={Boolean(user.apiEnabled)} />;
}
