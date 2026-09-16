// Pure calculation logic for the pizza calculator.
// No DOM access here — must be runnable and testable under plain Node.

export const APPETITE_FACTORS = Object.freeze({
  light: 0.8,
  normal: 1.0,
  large: 1.25,
});

export const OTHER_MEAL_FACTOR = 0.85;
export const EXTRA_PERCENT = 0.10;
export const DEFAULT_SERVING_UNITS_PER_PIZZA = 8;
export const LARGE_EVENT_THRESHOLD = 100;

export const YOUNG_CHILD_UNITS = 1.5; // ages 3-6
export const CHILD_UNITS = 2;         // ages 7-12 / unspecified children
export const TEEN_ADULT_UNITS = 3;    // ages 13+

export class ValidationError extends Error {
  constructor(field, message) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

function assertValidCount(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ValidationError(field, `הערך של ${field} חייב להיות מספר תקין`);
  }
  if (value < 0) {
    throw new ValidationError(field, `הערך של ${field} לא יכול להיות שלילי`);
  }
  if (!Number.isInteger(value)) {
    throw new ValidationError(field, `הערך של ${field} חייב להיות מספר שלם`);
  }
}

// Unlike participant counts, a "slices per person" rate is legitimately
// fractional (e.g. 2.5 on average), so this only rejects negative/non-finite.
function assertValidRate(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ValidationError(field, `הערך של ${field} חייב להיות מספר תקין`);
  }
  if (value < 0) {
    throw new ValidationError(field, `הערך של ${field} לא יכול להיות שלילי`);
  }
}

/**
 * @param {object} input
 * @param {number} [input.youngChildren=0] ages 3-6
 * @param {number} [input.children=0] ages 7-12 / unspecified
 * @param {number} [input.teensAndAdults=0] ages 13+
 * @param {"light"|"normal"|"large"} [input.appetite="normal"]
 * @param {boolean} [input.otherMeal=false] a full additional meal is served
 * @param {boolean} [input.extraPercent=false] user opted in to +10% planning buffer
 * @param {number} [input.servingUnitsPerPizza=8]
 * @param {{youngChild:number,child:number,teenAdult:number}|null} [input.customRates=null]
 *   Slices-per-person, overriding the appetite-based defaults entirely for
 *   all three groups. When set, `appetite` no longer scales demand (the
 *   custom numbers already represent exactly what each person eats).
 */
export function calculatePizzas(input = {}) {
  const {
    youngChildren = 0,
    children = 0,
    teensAndAdults = 0,
    appetite = "normal",
    otherMeal = false,
    extraPercent = false,
    servingUnitsPerPizza = DEFAULT_SERVING_UNITS_PER_PIZZA,
    customRates = null,
  } = input;

  assertValidCount(youngChildren, "youngChildren");
  assertValidCount(children, "children");
  assertValidCount(teensAndAdults, "teensAndAdults");
  assertValidCount(servingUnitsPerPizza, "servingUnitsPerPizza");

  if (servingUnitsPerPizza <= 0) {
    throw new ValidationError("servingUnitsPerPizza", "servingUnitsPerPizza חייב להיות גדול מאפס");
  }

  let youngChildRate, childRate, teenAdultRate, appetiteFactor;
  if (customRates) {
    assertValidRate(customRates.youngChild, "customRates.youngChild");
    assertValidRate(customRates.child, "customRates.child");
    assertValidRate(customRates.teenAdult, "customRates.teenAdult");
    youngChildRate = customRates.youngChild;
    childRate = customRates.child;
    teenAdultRate = customRates.teenAdult;
    appetiteFactor = 1; // already baked into the custom numbers
  } else {
    if (!(appetite in APPETITE_FACTORS)) {
      throw new ValidationError("appetite", `רמת תיאבון לא מוכרת: ${appetite}`);
    }
    appetiteFactor = APPETITE_FACTORS[appetite];
    youngChildRate = YOUNG_CHILD_UNITS;
    childRate = CHILD_UNITS;
    teenAdultRate = TEEN_ADULT_UNITS;
  }

  const totalParticipants = youngChildren + children + teensAndAdults;
  const isOversized = totalParticipants > LARGE_EVENT_THRESHOLD;

  const otherMealFactor = otherMeal ? OTHER_MEAL_FACTOR : 1.0;

  const youngChildrenUnits = youngChildRate * youngChildren;
  const childrenUnits = childRate * children;
  const teensAdultsUnits = teenAdultRate * teensAndAdults;

  const baseDemand = youngChildrenUnits + childrenUnits + teensAdultsUnits;
  const demand = baseDemand * appetiteFactor * otherMealFactor;
  const plannedDemand = demand * (extraPercent ? 1 + EXTRA_PERCENT : 1);

  // Cutting the same tray into more slices never changes how much food it is —
  // servingUnitsPerPizza models the tray, not the cut, so it must never be
  // derived from a "slices" input.
  const pizzas = totalParticipants === 0 ? 0 : Math.ceil(plannedDemand / servingUnitsPerPizza);

  return {
    input: { youngChildren, children, teensAndAdults, appetite, otherMeal, extraPercent, servingUnitsPerPizza, customRates },
    totalParticipants,
    isOversized,
    breakdown: { youngChildrenUnits, childrenUnits, teensAdultsUnits },
    rates: { youngChild: youngChildRate, child: childRate, teenAdult: teenAdultRate },
    usesCustomRates: Boolean(customRates),
    appetiteFactor,
    otherMealFactor,
    baseDemand,
    demand,
    plannedDemand,
    servingUnitsPerPizza,
    pizzas,
  };
}

/** The appetite-scaled default slices-per-person, used to pre-fill a "customize
 * per-person slices" UI so it starts from a sensible, familiar baseline. */
export function defaultRates(appetite = "normal") {
  if (!(appetite in APPETITE_FACTORS)) {
    throw new ValidationError("appetite", `רמת תיאבון לא מוכרת: ${appetite}`);
  }
  const factor = APPETITE_FACTORS[appetite];
  const round2 = (n) => Math.round(n * 100) / 100;
  return {
    youngChild: round2(YOUNG_CHILD_UNITS * factor),
    child: round2(CHILD_UNITS * factor),
    teenAdult: round2(TEEN_ADULT_UNITS * factor),
  };
}

/** Recommendation must never shrink when a participant is added, all else equal. */
export function isMonotonic(calculateFn, baseInput) {
  const base = calculateFn(baseInput);
  for (const field of ["youngChildren", "children", "teensAndAdults"]) {
    const bumped = calculateFn({ ...baseInput, [field]: (baseInput[field] ?? 0) + 1 });
    if (bumped.pizzas < base.pizzas) return false;
  }
  return true;
}
