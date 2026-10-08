import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculatePizzas } from "./calc.js";
import { build } from "./build-guides.mjs";

const read = (file) => readFileSync(new URL(file, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const generated = build();

test("generated pages are up to date (run `npm run build:guides`)", () => {
  for (const [file, content] of Object.entries(generated)) {
    assert.equal(read(file), content, `${file} is stale`);
  }
});

test("every tray count written in the guides matches the calculator", () => {
  let checked = 0;
  for (const file of Object.keys(generated)) {
    for (const [, y, c, t, a, shown] of read(file).matchAll(/data-calc="y=(\d+);c=(\d+);t=(\d+);a=(\w+)">(\d+)</g)) {
      const { pizzas } = calculatePizzas({ youngChildren: +y, children: +c, teensAndAdults: +t, appetite: a });
      assert.equal(+shown, pizzas, `${file}: y=${y} c=${c} t=${t} ${a}`);
      checked++;
    }
  }
  assert.ok(checked > 50, `only ${checked} cells found`);
});
