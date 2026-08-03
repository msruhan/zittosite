import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Masuk",
};

export default function LoginPage() {
  return (
    <AuthLayout
      title="Login"
      description="Silahkan login menggunakan username dan password anda"
    >
      <LoginForm redirectTo="/app/dashboard" audience="user" />
    </AuthLayout>
  );
}
