/** Mirrors the API password policy (apps/api/src/security/password.ts). */
export function passwordPolicyError(password: string): string | null {
  if (password.length < 10) return "Password minimal 10 karakter.";
  if (new TextEncoder().encode(password).length > 72) {
    return "Password terlalu panjang (maksimal 72 byte).";
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Password harus mengandung huruf dan angka.";
  }
  return null;
}
