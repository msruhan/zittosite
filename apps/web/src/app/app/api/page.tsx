import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/app-shell";
import { Card, CardBody } from "@/components/ui/card";
import {
  ApiConnectionCard,
  ApiDocsCard,
  ApiKeysPanel,
  WebhookPanel,
} from "@/components/domain/api-access-panels";
import { API_URL, ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import type { ApiKey, User, WebhookDelivery, WebhookEndpoint } from "@/lib/types";

export const metadata: Metadata = {
  title: "API Access",
};

export default async function ApiAccessPage() {
  let user: User;
  try {
    user = await serverApi<User>("/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  if (!user.apiEnabled) {
    return (
      <>
        <PageHeader title="API Access" />
        <Card className="mx-auto w-full max-w-xl">
          <CardBody>
            <p className="text-body font-medium text-ink">Akses API belum aktif</p>
            <p className="mt-1 text-body text-ink-soft">
              Hubungi admin untuk mengaktifkan akses API agar website Anda bisa mengirim order ke sini.
            </p>
          </CardBody>
        </Card>
      </>
    );
  }

  const [keys, webhook, deliveries] = await Promise.all([
    serverApi<{ username: string; keys: ApiKey[] }>("/api-keys"),
    serverApi<{ endpoint: WebhookEndpoint | null }>("/webhook"),
    serverApi<WebhookDelivery[]>("/webhook/deliveries"),
  ]);
  const endpoint = `${API_URL.replace(/\/$/, "")}/api/index.php`;

  return (
    <>
      <PageHeader
        title="API Access"
        description="Terima order di website atau panel Dhru Fusion Anda, lalu teruskan otomatis ke sini. Order API dibayar dari saldo."
      />
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <ApiConnectionCard endpoint={endpoint} username={keys.username} />
        <ApiKeysPanel initialKeys={keys.keys} />
        <WebhookPanel initialEndpoint={webhook.endpoint} initialDeliveries={deliveries} />
        <ApiDocsCard endpoint={endpoint} username={keys.username} />
      </div>
    </>
  );
}
