import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Send } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { Avatar } from "@/components/shell/user-chip";
import { Button } from "@/components/ui/button";
import { Card, CardBody, DetailRow } from "@/components/ui/card";
import { DataValue } from "@/components/ui/data-value";
import { Tag } from "@/components/ui/status-badge";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import { formatDate, formatRupiah } from "@/lib/format";
import type { User } from "@/lib/types";

export const metadata: Metadata = {
  title: "Profil",
};

export default async function ProfilPage() {
  let user: User;
  try {
    user = await serverApi<User>("/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  return (
    <>
      <PageHeader
        title="Profil"
        description="Informasi akun Anda. Perubahan data akun hanya dapat dilakukan oleh Super Admin."
      />

      <div className="mx-auto w-full max-w-xl space-y-4">
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <Avatar fullName={user.fullName} className="size-12 text-title" />
              <div>
                <p className="text-headline text-ink">{user.fullName}</p>
                <p className="font-data text-body text-ink-soft">
                  @{user.username}
                </p>
              </div>
            </div>

            <dl className="mt-5 divide-y divide-hairline border-t border-hairline">
              <DetailRow label="Status akun">
                {user.status === "active" ? (
                  <Tag className="border-cleared-edge bg-cleared-wash text-cleared-ink">
                    Aktif
                  </Tag>
                ) : (
                  <Tag className="border-refused-edge bg-refused-wash text-refused-ink">
                    Suspended
                  </Tag>
                )}
              </DetailRow>
              <DetailRow label="Telegram">
                {user.telegramHandle ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                    <Send className="size-3.5 text-action" aria-hidden="true" />
                    {user.telegramHandle}
                  </span>
                ) : (
                  <span className="text-ink-soft">Belum ditautkan</span>
                )}
              </DetailRow>
              <DetailRow label="Akses bot">
                {user.botAccess ? (
                  <Tag>Aktif</Tag>
                ) : (
                  <Tag>Nonaktif</Tag>
                )}
              </DetailRow>
              <DetailRow label="Harga khusus">
                {user.customPrice !== null && user.customPrice !== undefined ? (
                  <DataValue>{formatRupiah(user.customPrice)}</DataValue>
                ) : (
                  <span className="text-ink-soft">Mengikuti harga layanan</span>
                )}
              </DetailRow>
              <DetailRow label="Saldo kredit">
                <DataValue>
                  {formatRupiah(user.creditBalance ?? 0)}
                </DataValue>
              </DetailRow>
              <DetailRow label="Bergabung">
                <DataValue className="text-ink-soft">
                  {formatDate(user.createdAt)}
                </DataValue>
              </DetailRow>
            </dl>
          </CardBody>
        </Card>

        {!user.telegramHandle ? (
          <div className="rounded-lg border border-hairline bg-action-wash p-5">
            <p className="text-title text-ink">Tautkan Telegram</p>
            <p className="mt-1 text-body text-ink-soft">
              Setelah Telegram ditautkan, Anda bisa menerima notifikasi status
              order dan membuat order dari bot.
            </p>
            <Button asChild className="mt-4" variant="secondary">
              <Link href="/app/telegram">
                <Send className="size-4" aria-hidden="true" />
                Mulai penautan
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
}
