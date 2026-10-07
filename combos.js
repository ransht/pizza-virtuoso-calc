// Suggested ways to split the calculated tray count between toppings.
// Pure logic, no DOM — must be runnable and testable under plain Node.
//
// These are planning suggestions only. The flavors are deliberately the
// generic ones any pizzeria carries (there is still no verified event menu
// in config.js), and nothing here feeds back into the quantity calculation:
// the tray count always comes from calc.js and every combo sums to exactly it.

export const FLAVORS = Object.freeze({
  margherita: "מרגריטה",
  olives: "זיתים",
  mushrooms: "פטריות",
  corn: "תירס",
  onion: "בצל",
  tomato: "עגבניות",
  half: "חצי מרגריטה, חצי זיתים",
});

// Above this share of children the event is planned as a kids' event:
// plainer toppings and a bigger margherita majority.
export const KIDS_EVENT_SHARE = 0.5;

const PROFILES = {
  kids: [
    { id: "classic", name: "הולכים על בטוח", note: "רוב מרגריטה — מה שילדים הכי אוהבים", mix: [["margherita", 0.7], ["olives", 0.3]] },
    { id: "balanced", name: "מאוזן", note: "קלאסיקה לילדים, משהו נוסף למלווים", mix: [["margherita", 0.5], ["olives", 0.25], ["corn", 0.25]] },
    { id: "variety", name: "לכל הטעמים", note: "מגוון רחב, עם בסיס בטוח", mix: [["margherita", 0.4], ["corn", 0.2], ["olives", 0.2], ["mushrooms", 0.2]] },
  ],
  adults: [
    { id: "classic", name: "הולכים על בטוח", note: "קלאסיקות שכולם אוכלים", mix: [["margherita", 0.6], ["olives", 0.2], ["mushrooms", 0.2]] },
    { id: "balanced", name: "מאוזן", note: "חצי קלאסי, חצי עם תוספות", mix: [["margherita", 0.4], ["mushrooms", 0.2], ["olives", 0.2], ["onion", 0.2]] },
    { id: "variety", name: "לכל הטעמים", note: "הכי הרבה מגוון על השולחן", mix: [["margherita", 0.3], ["mushrooms", 0.2], ["olives", 0.2], ["onion", 0.15], ["tomato", 0.15]] },
  ],
};

// Largest-remainder apportionment: whole trays per flavor, summing to exactly
// `total`. Ties go to the flavor listed first, so margherita never loses one.
function apportion(total, mix) {
  const rows = mix.map(([flavor, weight], order) => {
    const exact = total * weight;
    return { flavor, order, count: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let left = total - rows.reduce((sum, r) => sum + r.count, 0);
  const byRemainder = [...rows].sort((a, b) => b.remainder - a.remainder || a.order - b.order);
  for (let i = 0; left > 0; i = (i + 1) % byRemainder.length, left--) byRemainder[i].count++;
  return rows.filter((r) => r.count > 0).map(({ flavor, count }) => ({ flavor, count }));
}

const signature = (items) => items.map((i) => `${i.flavor}:${i.count}`).join("|");

/**
 * @param {number} pizzas whole tray count from calculatePizzas()
 * @param {object} [options]
 * @param {number} [options.childShare=0] children / total participants (0..1)
 * @returns {{id:string,name:string,note:string,items:{flavor:string,count:number}[]}[]}
 *   Up to three distinct combos; fewer when the tray count is too small to
 *   tell them apart. Empty for a zero / invalid count.
 */
export function buildCombos(pizzas, { childShare = 0 } = {}) {
  if (!Number.isInteger(pizzas) || pizzas <= 0) return [];

  const profile = childShare >= KIDS_EVENT_SHARE ? PROFILES.kids : PROFILES.adults;
  const seen = new Set();
  const combos = [];
  for (const { id, name, note, mix } of profile) {
    const items = apportion(pizzas, mix);
    const key = signature(items);
    if (seen.has(key)) continue;
    seen.add(key);
    combos.push({ id, name, note, items });
  }

  // One tray can't be split between flavors — the only real alternative to a
  // plain margherita is a half-and-half.
  if (pizzas === 1) {
    combos.push({ id: "half", name: "חצי־חצי", note: "שני טעמים על אותו מגש", items: [{ flavor: "half", count: 1 }] });
  }
  return combos;
}

/** "4 מרגריטה, 2 זיתים, 1 פטריות" — short enough for a WhatsApp line. */
export function formatCombo(combo) {
  return combo.items
    .map((i) => (i.flavor === "half" ? FLAVORS.half : `${i.count} ${FLAVORS[i.flavor]}`))
    .join(", ");
}
