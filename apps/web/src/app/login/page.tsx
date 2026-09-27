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
    >
      <LoginForm redirectTo="/app/dashboard" audience="user" />
    </AuthLayout>
  );
}
