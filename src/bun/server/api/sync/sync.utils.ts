import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const SECRET_LENGTH = 32;

export function generateSecret(): string {
  return randomBytes(SECRET_LENGTH).toString("base64url");
}

export function hashSync(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function compareSync(secret: string, hash: string): boolean {
  const secretHash = hashSync(secret);
  try {
    return timingSafeEqual(
      Buffer.from(secretHash, "hex"),
      Buffer.from(hash, "hex")
    );
  } catch {
    return false;
  }
}

export function ulid(): string {
  return crypto.randomUUID();
}

export function calculatePayloadHash(payload: unknown): string {
  const canonical = canonicalStringify(payload);
  return createHash("sha256").update(canonical).digest("hex");
}

function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  const keys = Object.keys(value as object).sort();
  const pairs = keys.map((key) => {
    const val = canonicalStringify((value as Record<string, unknown>)[key]);
    return `${JSON.stringify(key)}:${val}`;
  });
  return `{${pairs.join(",")}}`;
}
