import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/app-shell";
import { TelegramBotCenterPanel } from "@/components/domain/telegram-panels";

export const metadata: Metadata = {
  title: "Telegram",
};

export default function UserTelegramPage() {
  return (
    <>
      <PageHeader
        title="Telegram"
        description="Hubungkan bot ZITTOSITE ke akun Telegram Anda untuk cek status dan saldo."
      />
      <div className="mx-auto max-w-2xl">
        <TelegramBotCenterPanel />
      </div>
    </>
  );
}
