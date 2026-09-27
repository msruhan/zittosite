import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { LoginForm } from "@/components/auth/login-form";
import { isMockMode } from "@/lib/mock-mode";

export const metadata: Metadata = {
  title: "Masuk Super Admin",
};

export default function AdminLoginPage() {
  return (
    <AuthLayout
      eyebrow="Super Admin"
      title="Control Panel"
      description={
        isMockMode()
          ? "Mode demo: isi username & password apa saja untuk masuk panel."
          : undefined
      }
      panel={{
        kicker: "Cara kerja konter",
        heading: "Website memantau. Telegram mengerjakan.",
        body: "Super Admin melihat antrean dan laporan di sini. Operator mengambil order dari bot.",
        steps: [
          "User membayar, order masuk antrean",
          "Admin pertama yang terima mengunci tiket",
          "Hasil kembali ke Order ID yang sama",
        ],
      }}
    >
      <LoginForm redirectTo="/admin/dashboard" audience="admin" />
    </AuthLayout>
  );
}
