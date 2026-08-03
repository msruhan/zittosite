import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { Notifications } from "@/components/shell/notifications";
import type { NotificationItem } from "@/components/shell/notifications";
import { UserChip } from "@/components/shell/user-chip";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import type { OrderDetail, User } from "@/lib/types";

export default async function UserPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user: User;
  let orders: OrderDetail[] = [];
  try {
    user = await serverApi<User>("/me");
    orders = await serverApi<OrderDetail[]>("/orders");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect("/login");
    }
    throw err;
  }

  const notifications: NotificationItem[] = orders
    .flatMap((order) => order.activity.slice(-1))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6)
    .map((log) => ({
      id: log.id,
      orderId: log.orderId,
      status: log.status,
      note: log.note,
      createdAt: log.createdAt,
    }));

  return (
    <AppShell
      variant="user"
      topbarRight={
        <>
          <Notifications items={notifications} />
          <UserChip
            fullName={user.fullName}
            subtitle={user.telegramHandle ?? `@${user.username}`}
          />
        </>
      }
    >
      {children}
    </AppShell>
  );
}
