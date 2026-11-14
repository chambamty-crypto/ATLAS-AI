import { createHash } from "node:crypto";

export function createSafetyIdentifier(userId) {
  if (typeof userId !== "string" || !userId.trim()) {
    throw new TypeError("A non-empty user identifier is required");
  }
  const digest = createHash("sha256").update(userId).digest("hex").slice(0, 32);
  return `atlas_${digest}`;
}
