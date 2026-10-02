import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { Notifications } from "@/components/shell/notifications";
import type { NotificationItem } from "@/components/shell/notifications";
import { UserChip } from "@/components/shell/user-chip";
import { AdsRunnerTicker } from "@/components/domain/ads-runner-ticker";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import type { OrderDetail, RunningAd, User } from "@/lib/types";
import { loadUserMenus } from "@/lib/server-user-menus";
import {
  disabledUserMenuHrefs,
  userMenuNavLabels,
  type UserMenus,
} from "@/lib/user-menus";

export default async function UserPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user: User;
  let orders: OrderDetail[] = [];
  let ads: RunningAd[] = [];
  let menus: UserMenus;
  try {
    user = await serverApi<User>("/me");
    [orders, ads, menus] = await Promise.all([
      serverApi<OrderDetail[]>("/orders"),
      serverApi<RunningAd[]>("/running-ads").catch(() => []),
      loadUserMenus(),
    ]);
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
      hideHrefs={[
        ...disabledUserMenuHrefs(menus),
        ...(user.apiEnabled ? [] : ["/app/api", "/app/docs"]),
      ]}
      navLabels={userMenuNavLabels(menus)}
      banner={<AdsRunnerTicker items={ads} />}
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
