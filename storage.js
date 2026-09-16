// Named local plan storage — lets an organizer save a few event setups on
// *this device/browser* and reload them later. There is no account and no
// sync: it is plain localStorage, scoped to this origin, one browser only.
//
// Design notes (why it's shaped this way):
// - Every read is defensive: corrupted/garbled JSON must degrade to an empty
//   list, never throw and break the page.
// - Every write can legitimately fail (private browsing in old Safari, a
//   full quota, storage disabled by the user/policy) — callers get a typed
//   error with a human message instead of an uncaught exception.
// - Saving under a name that already exists (case/whitespace-insensitive)
//   overwrites that plan instead of creating a duplicate, matching how
//   people expect "save" to behave for something they're iterating on.

const STORAGE_KEY = "pizzacalc:plans:v1";
export const MAX_PLANS = 20;
export const MAX_NAME_LENGTH = 60;

export class StorageUnavailableError extends Error {
  constructor(message = "אחסון מקומי אינו זמין בדפדפן הזה.") {
    super(message);
    this.name = "StorageUnavailableError";
  }
}
export class PlanValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "PlanValidationError";
  }
}

function isValidPlanShape(p) {
  return (
    p &&
    typeof p === "object" &&
    typeof p.id === "string" &&
    typeof p.name === "string" &&
    typeof p.updatedAt === "string" &&
    p.state &&
    typeof p.state === "object"
  );
}

function readRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isValidPlanShape) : [];
  } catch {
    // Corrupted value from a future/older schema version, or JSON.parse
    // failure — treat as "nothing saved" rather than breaking the page.
    return [];
  }
}

function writeRaw(plans) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  } catch {
    throw new StorageUnavailableError("לא ניתן לשמור: ייתכן שהאחסון המקומי מלא או חסום.");
  }
}

/** Not cached: storage can go from available to unavailable (quota, privacy
 * mode, policy change) between calls, so re-probe every time — it's cheap. */
export function isStorageAvailable() {
  try {
    const probeKey = "pizzacalc:__probe__";
    localStorage.setItem(probeKey, "1");
    localStorage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

export function listPlans() {
  if (!isStorageAvailable()) return [];
  return readRaw().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getPlan(id) {
  return readRaw().find((p) => p.id === id) ?? null;
}

export function findPlanByName(name) {
  const norm = name.trim().toLowerCase();
  return readRaw().find((p) => p.name.trim().toLowerCase() === norm) ?? null;
}

/**
 * @returns {{ plan: object, overwritten: boolean }}
 */
export function savePlan(name, state) {
  if (!isStorageAvailable()) throw new StorageUnavailableError();

  const trimmed = name.trim();
  if (!trimmed) throw new PlanValidationError("צריך לתת שם לתכנית.");
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new PlanValidationError(`השם ארוך מדי (עד ${MAX_NAME_LENGTH} תווים).`);
  }

  const plans = readRaw();
  const now = new Date().toISOString();
  const existing = plans.find((p) => p.name.trim().toLowerCase() === trimmed.toLowerCase());

  if (existing) {
    existing.state = state;
    existing.updatedAt = now;
    writeRaw(plans);
    return { plan: existing, overwritten: true };
  }

  if (plans.length >= MAX_PLANS) {
    throw new PlanValidationError(
      `הגעתם למספר המרבי של תכניות שמורות (${MAX_PLANS}). מחקו תכנית ישנה כדי לשמור חדשה.`
    );
  }

  const plan = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: trimmed,
    updatedAt: now,
    state,
  };
  plans.push(plan);
  writeRaw(plans);
  return { plan, overwritten: false };
}

export function deletePlan(id) {
  if (!isStorageAvailable()) return;
  writeRaw(readRaw().filter((p) => p.id !== id));
}
