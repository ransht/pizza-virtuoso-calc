import { test } from "node:test";
import assert from "node:assert/strict";
import { calculatePizzas, isMonotonic, defaultRates, ValidationError } from "./calc.js";

test("20 children + 4 adults, normal appetite -> 7 pizzas", () => {
  const r = calculatePizzas({ children: 20, teensAndAdults: 4, appetite: "normal" });
  assert.equal(r.baseDemand, 52);
  assert.equal(r.pizzas, 7);
});

test("same event + extraPercent -> 8 pizzas", () => {
  const r = calculatePizzas({ children: 20, teensAndAdults: 4, appetite: "normal", extraPercent: true });
  assert.equal(r.plannedDemand, 57.2);
  assert.equal(r.pizzas, 8);
});

test("same event + otherMeal (no extraPercent) -> 6 pizzas", () => {
  const r = calculatePizzas({ children: 20, teensAndAdults: 4, appetite: "normal", otherMeal: true });
  assert.ok(Math.abs(r.demand - 44.2) < 1e-9);
  assert.equal(r.pizzas, 6);
});

test("30 children, normal -> 8 pizzas", () => {
  const r = calculatePizzas({ children: 30, appetite: "normal" });
  assert.equal(r.pizzas, 8);
});

test("12 adults, normal -> 5 pizzas", () => {
  const r = calculatePizzas({ teensAndAdults: 12, appetite: "normal" });
  assert.equal(r.pizzas, 5);
});

test("20 young children (3-6), normal -> 4 pizzas", () => {
  const r = calculatePizzas({ youngChildren: 20, appetite: "normal" });
  assert.equal(r.baseDemand, 30);
  assert.equal(r.pizzas, 4);
});

test("zero participants -> 0 pizzas", () => {
  const r = calculatePizzas({});
  assert.equal(r.totalParticipants, 0);
  assert.equal(r.pizzas, 0);
});

test("changing servingUnitsPerPizza (simulating a different cut) is independent of food quantity", () => {
  const base = { children: 20, teensAndAdults: 4, appetite: "normal" };
  const cut8 = calculatePizzas({ ...base, servingUnitsPerPizza: 8 });
  const cut16 = calculatePizzas({ ...base, servingUnitsPerPizza: 16 });
  // demand (actual food needed) must be identical; only the per-tray unit count differs.
  assert.equal(cut8.demand, cut16.demand);
  assert.equal(cut8.pizzas, 7);
  assert.equal(cut16.pizzas, 4);
});

test("monotonicity: adding a participant never lowers the recommendation", () => {
  const scenarios = [
    { youngChildren: 0, children: 20, teensAndAdults: 4, appetite: "normal" },
    { youngChildren: 5, children: 0, teensAndAdults: 0, appetite: "light" },
    { youngChildren: 0, children: 0, teensAndAdults: 30, appetite: "large" },
    { youngChildren: 0, children: 0, teensAndAdults: 0, appetite: "normal" },
  ];
  for (const s of scenarios) {
    assert.ok(isMonotonic(calculatePizzas, s), `not monotonic for ${JSON.stringify(s)}`);
  }
});

test("over-100 participants is flagged as oversized but still computable", () => {
  const r = calculatePizzas({ children: 80, teensAndAdults: 25, appetite: "normal" });
  assert.equal(r.totalParticipants, 105);
  assert.equal(r.isOversized, true);
});

test("negative, fractional, and non-finite counts are rejected", () => {
  assert.throws(() => calculatePizzas({ children: -1 }), ValidationError);
  assert.throws(() => calculatePizzas({ children: 2.5 }), ValidationError);
  assert.throws(() => calculatePizzas({ children: NaN }), ValidationError);
  assert.throws(() => calculatePizzas({ children: Infinity }), ValidationError);
  assert.throws(() => calculatePizzas({ children: "20" }), ValidationError);
});

test("unknown appetite level is rejected", () => {
  assert.throws(() => calculatePizzas({ children: 5, appetite: "huge" }), ValidationError);
});

test("customRates overrides the appetite defaults: 4 slices/adult, 2/child", () => {
  const r = calculatePizzas({
    children: 10,
    teensAndAdults: 10,
    appetite: "large", // must be ignored once customRates is set
    customRates: { youngChild: 1, child: 2, teenAdult: 4 },
  });
  assert.equal(r.appetiteFactor, 1);
  assert.equal(r.usesCustomRates, true);
  assert.equal(r.baseDemand, 2 * 10 + 4 * 10); // 60
  assert.equal(r.pizzas, Math.ceil(60 / 8)); // 8
});

test("customRates still respects otherMeal and extraPercent", () => {
  const base = { teensAndAdults: 8, customRates: { youngChild: 0, child: 0, teenAdult: 4 } };
  const withOtherMeal = calculatePizzas({ ...base, otherMeal: true });
  const withExtra = calculatePizzas({ ...base, extraPercent: true });
  assert.equal(withOtherMeal.demand, 32 * 0.85);
  assert.equal(withExtra.plannedDemand, 32 * 1.10);
});

test("customRates rejects negative or non-finite values but allows fractions", () => {
  assert.throws(
    () => calculatePizzas({ children: 5, customRates: { youngChild: 0, child: -1, teenAdult: 3 } }),
    ValidationError
  );
  assert.throws(
    () => calculatePizzas({ children: 5, customRates: { youngChild: 0, child: NaN, teenAdult: 3 } }),
    ValidationError
  );
  // 2.5 slices/child must NOT throw — rates are allowed to be fractional.
  const r = calculatePizzas({ children: 4, customRates: { youngChild: 0, child: 2.5, teenAdult: 3 } });
  assert.equal(r.baseDemand, 10);
});

test("defaultRates scales the base slice assumptions by appetite, for pre-filling the custom-rate UI", () => {
  assert.deepEqual(defaultRates("normal"), { youngChild: 1.5, child: 2, teenAdult: 3 });
  assert.deepEqual(defaultRates("light"), { youngChild: 1.2, child: 1.6, teenAdult: 2.4 });
  assert.throws(() => defaultRates("huge"), ValidationError);
});
