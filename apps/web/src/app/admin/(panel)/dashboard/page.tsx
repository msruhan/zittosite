import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/app-shell";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { DataValue } from "@/components/ui/data-value";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableScroll,
} from "@/components/ui/table";
import { StatGrid, StatTile } from "@/components/domain/stat-tile";
import { TicketShowcase } from "@/components/domain/ticket-showcase";
import { ApiError } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import { formatDateTime, formatRupiah, maskImei } from "@/lib/format";
import type { OrderDetail } from "@/lib/types";

export const metadata: Metadata = {
  title: "Dashboard Super Admin",
};

type DashboardStats = {
  totalOrders: number;
  waitingAction: number;
  inProcess: number;
  done: number;
  ordersToday: number;
  totalUsers: number;
  activeServices: number;
  revenueToday: number;
  recentOrders: OrderDetail[];
};

export default async function AdminDashboardPage() {
  let stats: DashboardStats;
  try {
    stats = await serverApi<DashboardStats>("/admin/dashboard/stats");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/admin/login");
    throw err;
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Ringkasan operasional dari database: antrean, pengerjaan, dan pendapatan hari ini."
      />

      <div className="space-y-5 sm:space-y-6">
        <StatGrid>
          <StatTile
            index={0}
            tone="action"
            label="Total Order"
            value={stats.totalOrders}
            hint="Semua order di sistem, semua status."
            caption={`+${stats.ordersToday} dari hari ini`}
            href="/admin/orders"
          />
          <StatTile
            index={1}
            tone="working"
            label="Waiting Admin"
            value={stats.waitingAction}
            hint="Order berbayar yang menunggu diambil admin."
            caption="Menunggu diambil"
            href="/admin/orders"
          />
          <StatTile
            index={2}
            tone="sky"
            label="In Process"
            value={stats.inProcess}
            hint="Order yang sedang dikerjakan admin."
            caption="Sedang dikerjakan"
            href="/admin/orders"
          />
          <StatTile
            index={3}
            tone="cleared"
            label="Done"
            value={stats.done}
            hint="Order yang sudah selesai dikerjakan."
            caption="Selesai keseluruhan"
            href="/admin/orders"
          />
        </StatGrid>

        <TicketShowcase
          headline="Alur order yang sama, dari antrean sampai selesai."
          body="Super Admin memantau dari website. Operator mengerjakan lewat Telegram. Satu Order ID mengikat seluruh perjalanan."
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardBody>
              <p className="text-label uppercase text-ink-soft">User</p>
              <DataValue emphasis className="mt-1 block text-display">
                {stats.totalUsers}
              </DataValue>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-label uppercase text-ink-soft">Layanan aktif</p>
              <DataValue emphasis className="mt-1 block text-display">
                {stats.activeServices}
              </DataValue>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-label uppercase text-ink-soft">
                Pendapatan hari ini
              </p>
              <DataValue emphasis className="mt-1 block text-display">
                {formatRupiah(stats.revenueToday)}
              </DataValue>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Order terbaru</CardTitle>
            <Link
              href="/admin/orders"
              className="text-body font-medium text-action underline-offset-4 hover:underline"
            >
              Lihat semua
            </Link>
          </CardHeader>
          <div className="mt-4 border-t border-hairline">
            <TableScroll>
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Order ID</TH>
                    <TH>User</TH>
                    <TH>IMEI</TH>
                    <TH>Status</TH>
                    <TH>Dibuat</TH>
                  </TR>
                </THead>
                <TBody>
                  {stats.recentOrders.map((order) => (
                    <TR key={order.id}>
                      <TD>
                        <Link
                          href={`/admin/orders/${order.orderId}`}
                          className="font-data text-action hover:underline"
                        >
                          {order.orderId}
                        </Link>
                      </TD>
                      <TD>{order.user?.fullName ?? "—"}</TD>
                      <TD>
                        <DataValue>{maskImei(order.imei)}</DataValue>
                      </TD>
                      <TD>
                        <StatusBadge status={order.status} />
                      </TD>
                      <TD>
                        <DataValue className="text-ink-soft">
                          {formatDateTime(order.createdAt)}
                        </DataValue>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableScroll>
          </div>
        </Card>
      </div>
    </>
  );
}
