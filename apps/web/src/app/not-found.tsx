import Link from "next/link";
import { BrandLockup } from "@/components/shell/brand";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-5 text-center">
      <BrandLockup />
      <div className="space-y-2">
        <h1 className="text-display text-ink">Halaman tidak ditemukan</h1>
        <p className="mx-auto max-w-[42ch] text-body text-ink-soft">
          Alamat yang Anda buka tidak ada, atau order yang dicari sudah tidak
          tersedia.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link href="/app/dashboard">Ke dashboard</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/login">Ke login</Link>
        </Button>
      </div>
    </div>
  );
}
