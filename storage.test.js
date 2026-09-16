import { test } from "node:test";
import assert from "node:assert/strict";

class MemoryStorage {
  constructor() { this.store = new Map(); }
  getItem(k) { return this.store.has(k) ? this.store.get(k) : null; }
  setItem(k, v) { this.store.set(k, String(v)); }
  removeItem(k) { this.store.delete(k); }
}

globalThis.localStorage = new MemoryStorage();
const {
  savePlan, listPlans, deletePlan, getPlan, findPlanByName,
  isStorageAvailable, MAX_PLANS, StorageUnavailableError, PlanValidationError,
} = await import("./storage.js");

const sampleState = { event: "birthday", childrenTotal: 20, youngChildren: 0, teensAndAdults: 4, appetite: "normal", otherMeal: false, extraPercent: false };

test("storage is available against the in-memory mock", () => {
  assert.equal(isStorageAvailable(), true);
});

test("saving a new plan creates one entry", () => {
  globalThis.localStorage = new MemoryStorage();
  const { plan, overwritten } = savePlan("יום הולדת דניאלה", sampleState);
  assert.equal(overwritten, false);
  assert.equal(plan.name, "יום הולדת דניאלה");
  assert.equal(listPlans().length, 1);
});

test("saving under an existing name (trim/case-insensitive) overwrites instead of duplicating", () => {
  globalThis.localStorage = new MemoryStorage();
  savePlan("משרד", sampleState);
  const updatedState = { ...sampleState, teensAndAdults: 20 };
  const { overwritten, plan } = savePlan("  משרד  ", updatedState);
  assert.equal(overwritten, true);
  assert.equal(plan.state.teensAndAdults, 20);
  assert.equal(listPlans().length, 1);
});

test("empty or whitespace-only name is rejected", () => {
  globalThis.localStorage = new MemoryStorage();
  assert.throws(() => savePlan("   ", sampleState), PlanValidationError);
});

test("overly long name is rejected", () => {
  globalThis.localStorage = new MemoryStorage();
  assert.throws(() => savePlan("א".repeat(61), sampleState), PlanValidationError);
});

test("deletePlan removes exactly that plan", () => {
  globalThis.localStorage = new MemoryStorage();
  const { plan: a } = savePlan("אירוע א", sampleState);
  savePlan("אירוע ב", sampleState);
  deletePlan(a.id);
  const remaining = listPlans();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].name, "אירוע ב");
});

test("getPlan and findPlanByName locate a saved plan", () => {
  globalThis.localStorage = new MemoryStorage();
  const { plan } = savePlan("מסיבת גן", sampleState);
  assert.equal(getPlan(plan.id).name, "מסיבת גן");
  assert.equal(findPlanByName("מסיבת גן ").id, plan.id);
  assert.equal(findPlanByName("לא קיים"), null);
});

test("hitting MAX_PLANS blocks a new (not overwriting) save", () => {
  globalThis.localStorage = new MemoryStorage();
  for (let i = 0; i < MAX_PLANS; i++) savePlan(`אירוע ${i}`, sampleState);
  assert.throws(() => savePlan("אירוע חדש", sampleState), PlanValidationError);
  // but overwriting an existing one still works even when full
  assert.doesNotThrow(() => savePlan("אירוע 0", { ...sampleState, childrenTotal: 99 }));
});

test("corrupted stored JSON degrades to an empty list instead of throwing", () => {
  const bad = new MemoryStorage();
  bad.setItem("pizzacalc:plans:v1", "{not valid json");
  globalThis.localStorage = bad;
  assert.deepEqual(listPlans(), []);
});

test("a storage whose setItem always throws is reported as unavailable, and savePlan raises StorageUnavailableError", () => {
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => { throw new Error("quota exceeded"); },
    removeItem: () => {},
  };
  assert.equal(isStorageAvailable(), false);
  assert.throws(() => savePlan("אירוע", sampleState), StorageUnavailableError);
});

test("plans list is sorted most-recently-updated first", async () => {
  globalThis.localStorage = new MemoryStorage();
  savePlan("ישן", sampleState);
  await new Promise((r) => setTimeout(r, 5));
  savePlan("חדש", sampleState);
  const [first] = listPlans();
  assert.equal(first.name, "חדש");
});
