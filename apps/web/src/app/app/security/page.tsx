import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/app-shell";
import { ChangePasswordCard } from "@/components/domain/security-panels";

export const metadata: Metadata = {
  title: "Security",
};

export default function UserSecurityPage() {
  return (
    <>
      <PageHeader
        title="Security"
        description="Kelola password akun portal user Anda."
      />
      <div className="mx-auto max-w-2xl">
        <ChangePasswordCard endpoint="/me/password" />
      </div>
    </>
  );
}
