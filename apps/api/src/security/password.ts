import * as bcrypt from "bcryptjs";

/** Compared against when the account does not exist, so response time does not reveal valid usernames. */
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  "zittosite-timing-equalizer",
  10,
);

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_BYTES = 72;

/** Returns an error message, or null when the password is acceptable. */
export function passwordPolicyError(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password minimal ${MIN_PASSWORD_LENGTH} karakter.`;
  }
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    return "Password terlalu panjang (maksimal 72 byte).";
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Password harus mengandung huruf dan angka.";
  }
  return null;
}
