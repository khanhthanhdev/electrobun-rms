import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const SECRET_LENGTH = 32;

export const generateSecret = (): string =>
  randomBytes(SECRET_LENGTH).toString("base64url");

export const hashSyncSecret = (secret: string): string =>
  createHash("sha256").update(secret).digest("hex");

export const compareSyncSecret = (secret: string, hash: string): boolean => {
  const secretHash = hashSyncSecret(secret);
  try {
    return timingSafeEqual(
      Buffer.from(secretHash, "hex"),
      Buffer.from(hash, "hex")
    );
  } catch {
    return false;
  }
};

export const calculatePayloadHash = (payload: unknown): string =>
  createHash("sha256").update(canonicalStringify(payload)).digest("hex");

const canonicalStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }

  const keys = Object.keys(value as object).sort();
  const pairs = keys.map((key) => {
    const nestedValue = canonicalStringify(
      (value as Record<string, unknown>)[key]
    );
    return `${JSON.stringify(key)}:${nestedValue}`;
  });

  return `{${pairs.join(",")}}`;
};
