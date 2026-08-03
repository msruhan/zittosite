"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { ApiError, api } from "@/lib/api";
import { ORDER_STATUS_OPTIONS } from "@/lib/status";
import type { OrderStatus } from "@/lib/types";

export function AdminOrderStatusOverride({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: OrderStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = React.useState<OrderStatus>(currentStatus);
  const [saving, setSaving] = React.useState(false);

  async function onSave() {
    setSaving(true);
    try {
      await api(`/admin/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      toast.success("Status diperbarui");
      router.refresh();
    } catch (err) {
      toast.error("Gagal", {
        description: err instanceof ApiError ? err.message : "Update gagal",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-hairline pt-4">
      <Field label="Override status (Super Admin)" htmlFor="overrideStatus">
        <Select
          id="overrideStatus"
          value={status}
          onValueChange={(value) => setStatus(value as OrderStatus)}
          options={ORDER_STATUS_OPTIONS.filter(
            (o): o is { value: OrderStatus; label: string } => o.value !== "all",
          )}
        />
      </Field>
      <Button
        type="button"
        variant="secondary"
        loading={saving}
        loadingLabel="Menyimpan"
        onClick={() => void onSave()}
        disabled={status === currentStatus}
      >
        Simpan status
      </Button>
    </div>
  );
}
