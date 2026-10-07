import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCombos, formatCombo, FLAVORS } from "./combos.js";

const total = (combo) => combo.items.reduce((sum, i) => sum + i.count, 0);

test("every combo sums to exactly the calculated tray count", () => {
  for (const childShare of [0, 0.49, 0.5, 1]) {
    for (let pizzas = 1; pizzas <= 60; pizzas++) {
      for (const combo of buildCombos(pizzas, { childShare })) {
        assert.equal(total(combo), pizzas, `${combo.id} @ ${pizzas} trays, share ${childShare}`);
      }
    }
  }
});

test("7 trays for a kids' event -> three distinct combos", () => {
  const combos = buildCombos(7, { childShare: 20 / 24 });
  assert.deepEqual(combos.map((c) => c.id), ["classic", "balanced", "variety"]);
  assert.deepEqual(combos[0].items, [{ flavor: "margherita", count: 5 }, { flavor: "olives", count: 2 }]);
});

test("margherita is always present and never outnumbered", () => {
  for (const childShare of [0, 1]) {
    for (let pizzas = 2; pizzas <= 60; pizzas++) {
      for (const combo of buildCombos(pizzas, { childShare })) {
        const margherita = combo.items.find((i) => i.flavor === "margherita");
        assert.ok(margherita, `${combo.id} @ ${pizzas} has no margherita`);
        assert.ok(combo.items.every((i) => i.count <= margherita.count), `${combo.id} @ ${pizzas}`);
      }
    }
  }
});

test("combos are deduplicated when the count is too small to differ", () => {
  for (let pizzas = 1; pizzas <= 10; pizzas++) {
    const keys = buildCombos(pizzas).map((c) => formatCombo(c));
    assert.equal(new Set(keys).size, keys.length, `duplicates @ ${pizzas} trays`);
  }
});

test("a single tray offers plain margherita or a half-and-half", () => {
  const combos = buildCombos(1, { childShare: 1 });
  assert.deepEqual(combos.map((c) => c.id), ["classic", "half"]);
  assert.equal(formatCombo(combos[1]), FLAVORS.half);
});

test("zero or invalid counts produce no combos", () => {
  assert.deepEqual(buildCombos(0), []);
  assert.deepEqual(buildCombos(-2), []);
  assert.deepEqual(buildCombos(2.5), []);
});

test("formatCombo produces a short readable line", () => {
  const [classic] = buildCombos(5, { childShare: 0 });
  assert.equal(formatCombo(classic), "3 מרגריטה, 1 זיתים, 1 פטריות");
});
