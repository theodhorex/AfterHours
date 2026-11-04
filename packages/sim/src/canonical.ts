import { Buffer } from "node:buffer";

/**
 * Serializes a value into canonical JSON per data-contract section 1.
 * - UTF-8
 * - Object keys sorted lexicographically by UTF-8 byte order
 * - No whitespace
 * - Arrays keep their order
 * - Integers are BigInt and formatted as decimal strings (e.g. "1200")
 * - Strings, booleans, and null are supported
 * - Throws on undefined, numbers (floats, ints, NaN, Infinity), functions, symbols, Map, Set, or non-plain objects
 */
export function canonicalJson(value: unknown): string {
  if (value === undefined) {
    throw new TypeError("undefined is not allowed in canonical JSON");
  }

  if (typeof value === "number") {
    throw new TypeError(
      `Number values (${value}) are not allowed in canonical JSON (use bigint or string)`
    );
  }

  if (typeof value === "bigint") {
    return JSON.stringify(value.toString());
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (value === null) {
    return "null";
  }

  if (typeof value === "symbol") {
    throw new TypeError("Symbols are not allowed in canonical JSON");
  }

  if (typeof value === "function") {
    throw new TypeError("Functions are not allowed in canonical JSON");
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }

  if (typeof value === "object") {
    if (Object.prototype.toString.call(value) !== "[object Object]") {
      throw new TypeError(`Unsupported object type: ${Object.prototype.toString.call(value)}`);
    }

    const proto = Object.getPrototypeOf(value);
    if (proto !== null && proto !== Object.prototype) {
      throw new TypeError("Non-plain objects are not allowed in canonical JSON");
    }

    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw new TypeError("Symbol keys are not allowed in canonical JSON");
    }

    const keys = Object.keys(value);
    keys.sort((a, b) => {
      const bufA = Buffer.from(a, "utf8");
      const bufB = Buffer.from(b, "utf8");
      return bufA.compare(bufB);
    });

    const parts = keys.map(
      (k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`
    );
    return `{${parts.join(",")}}`;
  }

  throw new TypeError(`Unsupported value type: ${typeof value}`);
}
