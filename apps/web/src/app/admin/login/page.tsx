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
    >
      <LoginForm redirectTo="/admin/dashboard" audience="admin" />
    </AuthLayout>
  );
}
