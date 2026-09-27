import { BadRequestException } from "@nestjs/common";

/** Narrow untrusted JSON body values. Each returns undefined when the field is absent. */

export function optString(
  value: unknown,
  field: string,
  maxLength = 200,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new BadRequestException(`${field} harus berupa teks.`);
  }
  if (value.length > maxLength) {
    throw new BadRequestException(`${field} maksimal ${maxLength} karakter.`);
  }
  return value;
}

export function optNullableString(
  value: unknown,
  field: string,
  maxLength = 200,
): string | null | undefined {
  if (value === null) return null;
  return optString(value, field, maxLength);
}

export function optBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw new BadRequestException(`${field} harus true/false.`);
  }
  return value;
}

export function optNonNegativeInt(
  value: unknown,
  field: string,
): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new BadRequestException(`${field} harus bilangan bulat ≥ 0.`);
  }
  return value;
}

export function optNullableNonNegativeInt(
  value: unknown,
  field: string,
): number | null | undefined {
  if (value === null) return null;
  return optNonNegativeInt(value, field);
}

export function optIdList(
  value: unknown,
  field: string,
  maxItems = 100,
): string[] | undefined {
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    value.length > maxItems ||
    value.some((item) => typeof item !== "string" || !item || item.length > 64)
  ) {
    throw new BadRequestException(`${field} tidak valid.`);
  }
  return [...new Set(value as string[])];
}

export function optEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new BadRequestException(`${field} tidak valid.`);
  }
  return value as T;
}
