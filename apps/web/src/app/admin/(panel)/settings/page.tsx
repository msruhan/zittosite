"use client";

import * as React from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";

export default function AdminSettingsPage() {
  const [productName, setProductName] = React.useState("ZITTOSITE");
  const [supportHandle, setSupportHandle] = React.useState("@zittosite_support");
  const [invoiceMinutes, setInvoiceMinutes] = React.useState("30");
  const [paymentMode, setPaymentMode] = React.useState("manual");
  const [saving, setSaving] = React.useState(false);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    window.setTimeout(() => {
      setSaving(false);
      toast.success("Pengaturan disimpan", {
        description: "Perubahan berhasil diterapkan.",
      });
    }, 500);
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Konfigurasi sistem untuk panel Super Admin."
      />

      <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Identitas produk</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4 pt-3">
            <Field label="Nama produk" htmlFor="productName">
              <Input
                id="productName"
                value={productName}
                onChange={(event) => setProductName(event.target.value)}
              />
            </Field>
            <Field
              label="Support Telegram"
              htmlFor="support"
              hint="Ditampilkan di halaman login sebagai kanal bantuan."
            >
              <Input
                id="support"
                value={supportHandle}
                onChange={(event) => setSupportHandle(event.target.value)}
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pembayaran</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4 pt-3">
            <Field
              label="Mode payment gateway"
              htmlFor="paymentMode"
              hint="Integrasi gateway akan diaktifkan pada fase berikutnya."
            >
              <Select
                id="paymentMode"
                value={paymentMode}
                onValueChange={setPaymentMode}
                options={[
                  { value: "manual", label: "Manual / mark-paid" },
                  { value: "midtrans", label: "Midtrans (belum terhubung)" },
                  { value: "xendit", label: "Xendit (belum terhubung)" },
                ]}
              />
            </Field>
            <Field
              label="Batas waktu invoice (menit)"
              htmlFor="invoiceMinutes"
            >
              <Input
                id="invoiceMinutes"
                inputMode="numeric"
                className="font-data tabular"
                value={invoiceMinutes}
                onChange={(event) =>
                  setInvoiceMinutes(event.target.value.replace(/\D/g, ""))
                }
              />
            </Field>
          </CardBody>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" loading={saving} loadingLabel="Menyimpan">
            Simpan pengaturan
          </Button>
        </div>
      </form>
    </>
  );
}
