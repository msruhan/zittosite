import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Masuk Super Admin",
};

export default function AdminLoginPage() {
  return (
    <AuthLayout eyebrow="Super Admin" title="Control Panel">
      <LoginForm redirectTo="/admin/dashboard" audience="admin" />
    </AuthLayout>
  );
}
