import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/app-shell";
import {
  AdminTotpCard,
  ChangePasswordCard,
} from "@/components/domain/security-panels";
import { AdminTelegramPanel } from "@/components/domain/telegram-panels";

export const metadata: Metadata = {
  title: "Security",
};

export default function AdminSecurityPage() {
  return (
    <>
      <PageHeader
        title="Security"
        description="Ganti password, Google Authenticator, dan tautan Telegram Admin."
      />
      <div className="mx-auto max-w-2xl space-y-4">
        <ChangePasswordCard
          endpoint="/admin/me/password"
          requireTotp
          loginHref="/admin/login"
        />
        <AdminTotpCard />
        <AdminTelegramPanel />
      </div>
    </>
  );
}
