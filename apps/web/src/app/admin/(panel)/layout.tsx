import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { UserChip } from "@/components/shell/user-chip";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";

export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let admin: { fullName: string; username: string; role: string };
  try {
    admin = await serverApi<{
      fullName: string;
      username: string;
      role: string;
    }>("/admin/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect("/admin/login");
    }
    throw err;
  }

  return (
    <AppShell
      variant="admin"
      navLabel="MAIN MENU"
      hideHrefs={
        admin.role === "super_admin" ? undefined : ["/admin/admins"]
      }
      topbarRight={
        <UserChip
          fullName={admin.fullName}
          subtitle={`@${admin.username}`}
        />
      }
    >
      {children}
    </AppShell>
  );
}
