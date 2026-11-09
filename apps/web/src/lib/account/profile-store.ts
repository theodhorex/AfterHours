import { MAX_CITIES_PER_ACCOUNT, type AccountProfile } from "./types.ts";

export { MAX_CITIES_PER_ACCOUNT };

export const HONEST_PROFILE_STORAGE_LABEL =
  "Your profile is stored in this browser, not on-chain.";

const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;

const ADJECTIVES = [
  "Brassy",
  "Rusty",
  "Swift",
  "Bold",
  "Ancient",
  "Crafty",
  "Keen",
  "Wild",
  "Stalwart",
  "Merry",
  "Gilded",
  "Iron",
  "Silent",
  "Noble",
  "Frosty",
  "Ember",
] as const;

const NOUNS = [
  "Goblin",
  "Miner",
  "Shaman",
  "Ranger",
  "Tinker",
  "Forger",
  "Scribe",
  "Elder",
  "Scout",
  "Courier",
  "Brewer",
  "Mason",
  "Warden",
  "Weaver",
  "Trader",
  "Digger",
] as const;

/**
 * Validates a username string according to system rules.
 * Username must be 3 to 20 characters of letters, digits, underscore, or hyphen.
 */
export function validateUsername(username: string): { valid: boolean; error?: string } {
  if (typeof username !== "string") {
    return { valid: false, error: "Username must be a string." };
  }
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 20) {
    return {
      valid: false,
      error: "Username must be between 3 and 20 characters.",
    };
  }
  if (!USERNAME_REGEX.test(trimmed)) {
    return {
      valid: false,
      error: "Username may only contain letters, digits, underscore, or hyphen.",
    };
  }
  return { valid: true };
}

/**
 * Validates selected city IDs:
 * Maximum MAX_CITIES_PER_ACCOUNT (2) and no duplicates.
 */
export function validateCityIds(cityIds: string[]): { valid: boolean; error?: string } {
  if (!Array.isArray(cityIds)) {
    return { valid: false, error: "City selection must be an array." };
  }
  if (cityIds.length > MAX_CITIES_PER_ACCOUNT) {
    return {
      valid: false,
      error: `You may select at most ${MAX_CITIES_PER_ACCOUNT} cities.`,
    };
  }
  const unique = new Set(cityIds);
  if (unique.size !== cityIds.length) {
    return { valid: false, error: "Duplicate city selections are not permitted." };
  }
  return { valid: true };
}

/**
 * Validates the entire AccountProfile object.
 */
export function validateProfile(profile: unknown): { valid: boolean; error?: string } {
  if (!profile || typeof profile !== "object") {
    return { valid: false, error: "Profile must be an object." };
  }
  const p = profile as Record<string, unknown>;
  if (typeof p.accountId !== "string" || p.accountId.trim().length === 0) {
    return { valid: false, error: "Account ID is required." };
  }
  const userValid = validateUsername(p.username as string);
  if (!userValid.valid) return userValid;

  const cityValid = validateCityIds(p.cityIds as string[]);
  if (!cityValid.valid) return cityValid;

  return { valid: true };
}

/**
 * 32-bit FNV-1a hash function for deterministic name generation without Math.random.
 */
function fnv1a(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Generates a deterministic fun name from an accountId (e.g. "Brassy-Goblin-42").
 * Zero Math.random, fully repeatable for the same accountId.
 */
export function suggestUsername(accountId: string): string {
  const hash = fnv1a(accountId || "default");
  const adjIndex = (hash >>> 8) % ADJECTIVES.length;
  const nounIndex = (hash >>> 16) % NOUNS.length;
  const num = (hash % 90) + 10; // 10 to 99

  const adj = ADJECTIVES[adjIndex];
  const noun = NOUNS[nounIndex];
  return `${adj}-${noun}-${num}`;
}

const STORAGE_PREFIX = "afterhours_profile_";

/**
 * Safe localStorage reader. Swallows all storage/parse errors and returns null.
 * Never throws into render.
 */
export function loadProfile(accountId: string): AccountProfile | null {
  if (!accountId) return null;
  if (typeof localStorage === "undefined") return null;

  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${accountId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const valid = validateProfile(parsed);
    if (!valid.valid) return null;
    return parsed as AccountProfile;
  } catch {
    return null;
  }
}

/**
 * Safe localStorage writer. Swallows all storage/quota errors.
 * Returns true if successfully saved, false otherwise.
 */
export function saveProfile(profile: AccountProfile): boolean {
  if (!profile || typeof profile !== "object") return false;
  const valid = validateProfile(profile);
  if (!valid.valid) return false;
  if (typeof localStorage === "undefined") return false;

  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${profile.accountId}`,
      JSON.stringify(profile)
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Safe localStorage remover. Swallows all storage errors.
 */
export function clearProfile(accountId: string): boolean {
  if (!accountId) return false;
  if (typeof localStorage === "undefined") return false;

  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${accountId}`);
    return true;
  } catch {
    return false;
  }
}
