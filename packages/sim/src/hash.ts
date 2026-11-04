import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { canonicalJson } from "./canonical.ts";

/**
 * Computes SHA-256 of canonical JSON serialization of a value.
 * Returns raw 32 bytes (Uint8Array).
 */
export function leaf(value: unknown): Uint8Array {
  const jsonStr = canonicalJson(value);
  const hash = createHash("sha256").update(jsonStr, "utf8").digest();
  return new Uint8Array(hash.buffer, hash.byteOffset, hash.byteLength);
}

/**
 * Computes SHA-256 of the concatenation of the raw 32-byte digests.
 * H(h1, ..., hn) = SHA-256(h1 || ... || hn).
 */
export function node(...hashes: Uint8Array[]): Uint8Array {
  const hasher = createHash("sha256");
  for (const h of hashes) {
    hasher.update(h);
  }
  const digest = hasher.digest();
  return new Uint8Array(digest.buffer, digest.byteOffset, digest.byteLength);
}

/**
 * Encodes Uint8Array into a lowercase hex string.
 */
export function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    .toString("hex")
    .toLowerCase();
}

/**
 * Decodes a hex string into a Uint8Array. Throws on odd length or invalid hex characters.
 */
export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error(`Hex string must have even length, got length ${hex.length}`);
  }
  if (!/^[0-9a-fA-F]*$/.test(hex)) {
    throw new Error(`Invalid hex string: ${hex}`);
  }
  const buf = Buffer.from(hex, "hex");
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}
