import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { LoginForm } from "@/components/auth/login-form";
import { isMockMode } from "@/lib/mock-mode";

export const metadata: Metadata = {
  title: "Masuk",
};

export default function LoginPage() {
  return (
    <AuthLayout
      title="Login"
      description={
        isMockMode()
          ? "Mode demo: isi username & password apa saja untuk masuk dashboard."
          : "Silahkan login menggunakan username dan password anda"
      }
      panel={{
        kicker: "Yang Anda bawa pulang",
        heading: "Satu Order ID",
        body: "Nomor tiket tidak berubah dari pembayaran sampai hasil. Cek statusnya di sini kapan saja.",
        steps: [
          "Buat order dan dapatkan nomor tiket",
          "Bayar, lalu pantau antrian admin",
          "Hasil kembali ke tiket yang sama",
        ],
      }}
    >
      <LoginForm redirectTo="/app/dashboard" audience="user" />
    </AuthLayout>
  );
}
