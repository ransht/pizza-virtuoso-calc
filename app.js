import { calculatePizzas, defaultRates, ValidationError, APPETITE_FACTORS } from "./calc.js";
import { CONFIG } from "./config.js";
import {
  savePlan,
  listPlans,
  deletePlan,
  getPlan,
  isStorageAvailable,
  StorageUnavailableError,
  PlanValidationError,
} from "./storage.js";

function toWhatsAppNumber(localPhone) {
  return localPhone.replace(/^0/, "972");
}

// ---------- analytics stub ----------
function track(name, payload = {}) {
  console.debug("[track]", name, payload);
  if (window.dataLayer) window.dataLayer.push({ event: name, ...payload });
}

// ---------- event-type copy ----------
const EVENT_TYPES = {
  birthday: {
    childrenLabel: "ילדים",
    teensLabel: "מלווים",
    summary: (c, t) => (c > 0 ? `ל-${c} ילדים ו-${t} מלווים` : `ל-${t} מלווים`),
    defaults: { childrenTotal: 20, teensAndAdults: 4 },
  },
  school: {
    childrenLabel: "ילדים בכיתה",
    teensLabel: "מבוגרים מלווים",
    summary: (c, t) => `ל-${c} ילדים בכיתה ו-${t} מבוגרים מלווים`,
    defaults: { childrenTotal: 25, teensAndAdults: 3 },
  },
  friends: {
    childrenLabel: "ילדים",
    teensLabel: "מבוגרים",
    summary: (c, t) => (c > 0 ? `ל-${c} ילדים ו-${t} מבוגרים` : `ל-${t} מבוגרים`),
    defaults: { childrenTotal: 0, teensAndAdults: 12 },
  },
  office: {
    // Offices don't usually have kids around — default the "children" count
    // to 0 so a work event starts from a sensible, mostly-adults baseline.
    childrenLabel: "ילדים (אם יש)",
    teensLabel: "עובדים ואורחים",
    summary: (c, t) => (c > 0 ? `ל-${t} עובדים ו-${c} ילדים` : `ל-${t} עובדים ואורחים`),
    defaults: { childrenTotal: 0, teensAndAdults: 15 },
  },
};

const APPETITE_LABELS = { light: "קל", normal: "רגיל", large: "גדול" };

const DEFAULTS = {
  event: "birthday",
  ...EVENT_TYPES.birthday.defaults,
  youngChildren: 0,
  appetite: "normal",
  otherMeal: false,
  extraPercent: false,
  customRates: null, // { youngChild, child, teenAdult } slices-per-person overrides
};

// ---------- DOM refs ----------
const el = (id) => document.getElementById(id);
const refs = {
  brandName: el("brandName"),
  exampleBanner: el("exampleBanner"),
  sharedBanner: el("sharedBanner"),
  linkErrorBanner: el("linkErrorBanner"),
  eventGrid: el("eventGrid"),
  childrenInput: el("childrenInput"),
  childrenError: el("childrenError"),
  teensAdultsInput: el("teensAdultsInput"),
  teensAdultsError: el("teensAdultsError"),
  youngChildrenInput: el("youngChildrenInput"),
  youngChildrenError: el("youngChildrenError"),
  childrenLabel: el("childrenLabel"),
  teensAdultsLabel: el("teensAdultsLabel"),
  appetiteGroup: el("appetiteGroup"),
  otherMealInput: el("otherMealInput"),
  extraPercentInput: el("extraPercentInput"),
  extraPercentLabel: el("extraPercentLabel"),
  customRatesToggle: el("customRatesToggle"),
  customRatesFields: el("customRatesFields"),
  youngChildRateInput: el("youngChildRateInput"),
  youngChildRateError: el("youngChildRateError"),
  childRateInput: el("childRateInput"),
  childRateError: el("childRateError"),
  teenAdultRateInput: el("teenAdultRateInput"),
  teenAdultRateError: el("teenAdultRateError"),
  resetRatesBtn: el("resetRatesBtn"),
  oversizedNotice: el("oversizedNotice"),
  resultCard: el("resultCard"),
  resultNumber: el("resultNumber"),
  resultSummary: el("resultSummary"),
  resultAssumptions: el("resultAssumptions"),
  explanationText: el("explanationText"),
  priceBlock: el("priceBlock"),
  priceLine: el("priceLine"),
  perGuestLine: el("perGuestLine"),
  quoteCta: el("quoteCta"),
  orderCta: el("orderCta"),
  shareBtn: el("shareBtn"),
  copyBtn: el("copyBtn"),
  copyFallback: el("copyFallback"),
  stickyBar: el("stickyBar"),
  stickyCount: el("stickyCount"),
  stickyQuoteCta: el("stickyQuoteCta"),
  examplesTableBody: el("examplesTableBody"),
  activePlanChip: el("activePlanChip"),
  storageUnavailableNotice: el("storageUnavailableNotice"),
  savePlanForm: el("savePlanForm"),
  planNameInput: el("planNameInput"),
  savePlanStatus: el("savePlanStatus"),
  noPlansHint: el("noPlansHint"),
  savedPlansListHeading: el("savedPlansListHeading"),
  savedPlansList: el("savedPlansList"),
};

// ---------- state ----------
let state = { ...DEFAULTS };
let isExample = true;

// ---------- URL fragment (share state) ----------
function parseFragment() {
  const raw = location.hash.replace(/^#/, "");
  if (!raw) return { present: false };

  // A plain in-page anchor (e.g. `#main-content` from the skip link, or
  // `#accessibility-statement` from the footer) never contains "=" — only
  // our own share-state fragments look like a query string. Anything else
  // is just normal page navigation: don't validate it, and don't touch
  // calculator state over it (a mid-session click on the footer link must
  // not wipe out whatever the user was already editing).
  if (!raw.includes("=")) return { present: false, isPlainAnchor: true };

  const params = new URLSearchParams(raw);
  if (!params.has("v")) return { present: true, valid: false };

  try {
    const yc = Number(params.get("yc") ?? "0");
    const c = Number(params.get("c") ?? "0");
    const t = Number(params.get("t") ?? "0");
    const appetite = params.get("appetite") ?? "normal";
    const otherMeal = params.get("otherMeal") === "1";
    const extraPercent = params.get("extra") === "1";
    const event = params.get("event") ?? "birthday";

    const isNonNegInt = (n) => Number.isFinite(n) && Number.isInteger(n) && n >= 0;
    if (![yc, c, t].every(isNonNegInt)) return { present: true, valid: false };
    if (!(appetite in APPETITE_FACTORS)) return { present: true, valid: false };
    if (!(event in EVENT_TYPES)) return { present: true, valid: false };
    if (yc > c) return { present: true, valid: false };

    let customRates = null;
    if (params.get("cu") === "1") {
      const ycr = Number(params.get("ycr") ?? "");
      const cr = Number(params.get("cr") ?? "");
      const tar = Number(params.get("tar") ?? "");
      const isNonNegNumber = (n) => Number.isFinite(n) && n >= 0;
      if (![ycr, cr, tar].every(isNonNegNumber)) return { present: true, valid: false };
      customRates = { youngChild: ycr, child: cr, teenAdult: tar };
    }

    return {
      present: true,
      valid: true,
      state: { event, childrenTotal: c, youngChildren: yc, teensAndAdults: t, appetite, otherMeal, extraPercent, customRates },
    };
  } catch {
    return { present: true, valid: false };
  }
}

function buildShareUrl() {
  const p = new URLSearchParams();
  p.set("v", "1");
  p.set("event", state.event);
  p.set("yc", String(state.youngChildren));
  p.set("c", String(state.childrenTotal));
  p.set("t", String(state.teensAndAdults));
  p.set("appetite", state.appetite);
  p.set("otherMeal", state.otherMeal ? "1" : "0");
  p.set("extra", state.extraPercent ? "1" : "0");
  if (state.customRates) {
    p.set("cu", "1");
    p.set("ycr", String(state.customRates.youngChild));
    p.set("cr", String(state.customRates.child));
    p.set("tar", String(state.customRates.teenAdult));
  }
  return `${location.origin}${location.pathname}#${p.toString()}`;
}

function updateUrl() {
  history.replaceState(null, "", buildShareUrl().replace(/^.*(?=#)/, ""));
}

// ---------- field error helpers ----------
function setFieldError(inputEl, errorEl, message) {
  inputEl.closest(".field-group")?.classList.add("has-error");
  errorEl.textContent = message;
  errorEl.hidden = false;
}
function clearFieldError(inputEl, errorEl) {
  inputEl.closest(".field-group")?.classList.remove("has-error");
  errorEl.hidden = true;
  errorEl.textContent = "";
}

function readCount(inputEl, errorEl) {
  const raw = inputEl.value.trim();
  clearFieldError(inputEl, errorEl);
  if (raw === "") return { pending: true };
  const num = Number(raw);
  if (!Number.isFinite(num)) {
    setFieldError(inputEl, errorEl, "יש להזין מספר תקין");
    return { invalid: true };
  }
  if (num < 0) {
    setFieldError(inputEl, errorEl, "הערך לא יכול להיות שלילי");
    return { invalid: true };
  }
  if (!Number.isInteger(num)) {
    setFieldError(inputEl, errorEl, "יש להזין מספר שלם");
    return { invalid: true };
  }
  return { value: num };
}

// Like readCount, but for a "slices per person" rate — fractional values
// (e.g. 2.5) are legitimate here, unlike a headcount.
function readRate(inputEl, errorEl) {
  const raw = inputEl.value.trim();
  clearFieldError(inputEl, errorEl);
  if (raw === "") return { pending: true };
  const num = Number(raw);
  if (!Number.isFinite(num)) {
    setFieldError(inputEl, errorEl, "יש להזין מספר תקין");
    return { invalid: true };
  }
  if (num < 0) {
    setFieldError(inputEl, errorEl, "הערך לא יכול להיות שלילי");
    return { invalid: true };
  }
  return { value: num };
}

// ---------- explanation text ----------
function buildExplanation(result, labels) {
  const parts = [];
  if (result.breakdown.youngChildrenUnits > 0) {
    parts.push(`${result.breakdown.youngChildrenUnits} יחידות לילדים בגיל 3–6`);
  }
  if (result.breakdown.childrenUnits > 0) {
    parts.push(`${result.breakdown.childrenUnits} יחידות ל${labels.childrenLabel}`);
  }
  if (result.breakdown.teensAdultsUnits > 0) {
    parts.push(`${result.breakdown.teensAdultsUnits} יחידות ל${labels.teensLabel}`);
  }
  let text = parts.length
    ? `${parts.join(" + ")}, חלקי ${result.servingUnitsPerPizza} למגש, בעיגול למעלה.`
    : "אין עדיין משתתפים לחישוב.";

  if (result.usesCustomRates) {
    text += " מבוסס על ההתאמה האישית שלכם לפרוסות לאדם, לא על רמת התיאבון.";
  } else if (result.appetiteFactor !== 1) {
    text += ` הותאם לרמת התיאבון שנבחרה (×${result.appetiteFactor}).`;
  }
  if (result.otherMealFactor !== 1) {
    text += ` מנה משביעה נוספת מפחיתה את הכמות (×${result.otherMealFactor}).`;
  }
  if (state.extraPercent) {
    text += " נוספו 10% לתכנון לפי בחירתכם.";
  }
  return text;
}

// ---------- render ----------
let lastResult = null;

function render() {
  // event picker
  [...refs.eventGrid.children].forEach((btn) => {
    btn.setAttribute("aria-checked", String(btn.dataset.event === state.event));
  });
  const labels = EVENT_TYPES[state.event];
  refs.childrenLabel.textContent = labels.childrenLabel;
  refs.teensAdultsLabel.textContent = labels.teensLabel;

  refs.exampleBanner.hidden = !isExample;
  if (isExample) {
    refs.exampleBanner.textContent =
      `זו דוגמה ${labels.summary(state.childrenTotal, state.teensAndAdults)} — התאימו אותה לאירוע שלכם ברגע ששינוי ראשון נעשה.`;
  }

  // appetite segmented control — visually de-emphasized while custom
  // per-person rates are active, since it no longer affects the result
  [...refs.appetiteGroup.children].forEach((btn) => {
    btn.setAttribute("aria-checked", String(btn.dataset.value === state.appetite));
  });
  refs.appetiteGroup.classList.toggle("is-inert", Boolean(state.customRates));

  refs.otherMealInput.checked = state.otherMeal;
  refs.extraPercentInput.checked = state.extraPercent;
  refs.customRatesToggle.checked = Boolean(state.customRates);
  refs.customRatesFields.hidden = !state.customRates;

  // read live counts (may be pending/invalid while user is editing)
  const childrenRead = readCount(refs.childrenInput, refs.childrenError);
  const teensRead = readCount(refs.teensAdultsInput, refs.teensAdultsError);
  const youngRead = readCount(refs.youngChildrenInput, refs.youngChildrenError);

  let ratesBlocked = false;
  if (state.customRates) {
    const ycRate = readRate(refs.youngChildRateInput, refs.youngChildRateError);
    const cRate = readRate(refs.childRateInput, refs.childRateError);
    const taRate = readRate(refs.teenAdultRateInput, refs.teenAdultRateError);
    ratesBlocked = ycRate.pending || ycRate.invalid || cRate.pending || cRate.invalid || taRate.pending || taRate.invalid;
    if (!ratesBlocked) {
      state.customRates = { youngChild: ycRate.value, child: cRate.value, teenAdult: taRate.value };
    }
  } else {
    clearFieldError(refs.youngChildRateInput, refs.youngChildRateError);
    clearFieldError(refs.childRateInput, refs.childRateError);
    clearFieldError(refs.teenAdultRateInput, refs.teenAdultRateError);
  }

  const blocked = childrenRead.pending || childrenRead.invalid
    || teensRead.pending || teensRead.invalid
    || youngRead.pending || youngRead.invalid
    || ratesBlocked;

  if (blocked) {
    refs.resultCard.classList.add("is-pending");
    refs.resultNumber.textContent = "…";
    refs.resultSummary.textContent = "ממתינים לקלט תקין";
    refs.resultAssumptions.textContent = "";
    refs.explanationText.textContent = "";
    refs.oversizedNotice.hidden = true;
    updateCta(null);
    updateStickyBar(null);
    return;
  }
  refs.resultCard.classList.remove("is-pending");

  // clamp young-children subset to the total (a UI constraint, not a format error)
  let youngChildren = youngRead.value;
  if (youngChildren > childrenRead.value) {
    youngChildren = childrenRead.value;
    refs.youngChildrenInput.value = String(youngChildren);
  }
  const regularChildren = childrenRead.value - youngChildren;

  // keep state in sync with the live DOM values so sharing/URL serialization
  // (which read from `state`, not the inputs) never go stale after an edit
  state.childrenTotal = childrenRead.value;
  state.teensAndAdults = teensRead.value;
  state.youngChildren = youngChildren;

  let result;
  try {
    result = calculatePizzas({
      youngChildren,
      children: regularChildren,
      teensAndAdults: teensRead.value,
      appetite: state.appetite,
      otherMeal: state.otherMeal,
      extraPercent: state.extraPercent,
      servingUnitsPerPizza: CONFIG.product.servingUnitsPerPizza,
      customRates: state.customRates,
    });
  } catch (err) {
    if (err instanceof ValidationError) return; // defensive; inputs are pre-validated above
    throw err;
  }
  lastResult = result;

  refs.oversizedNotice.hidden = !result.isOversized;

  if (result.isOversized) {
    refs.resultNumber.textContent = "—";
    refs.resultSummary.textContent = labels.summary(childrenRead.value, teensRead.value);
    refs.resultAssumptions.textContent = "";
    refs.explanationText.textContent = "";
    updateCta(null);
    updateStickyBar(null);
    return;
  }

  const pizzaWord = result.pizzas === 1 ? "מגש אחד" : `${result.pizzas} מגשים`;
  refs.resultNumber.textContent = pizzaWord;
  refs.resultSummary.textContent = labels.summary(childrenRead.value, teensRead.value);
  const otherMealPart = state.otherMeal ? "עם מנה משביעה נוספת." : "בלי אוכל משביע נוסף.";
  refs.resultAssumptions.textContent = result.usesCustomRates
    ? `לפי ההתאמה האישית שלכם לפרוסות, ${otherMealPart}`
    : `לפי תיאבון ${APPETITE_LABELS[state.appetite]}, ${otherMealPart}`;
  refs.explanationText.textContent = buildExplanation(result, labels);

  // price — only if a real, verified price exists in config
  if (CONFIG.product.price != null) {
    refs.priceBlock.hidden = false;
    const total = CONFIG.product.price * result.pizzas;
    refs.priceLine.textContent = `מחיר הפיצות: ${total} ${CONFIG.product.currency}`;
    const totalGuests = result.totalParticipants || 1;
    refs.perGuestLine.textContent = `בערך ${(total / totalGuests).toFixed(1)} ${CONFIG.product.currency} לאורח`;
  } else {
    refs.priceBlock.hidden = true;
  }

  updateCta(result);
  updateStickyBar(result);
  track("result_view", { modelVersion: CONFIG.modelVersion, pizzas: result.pizzas, event: state.event });
  updateUrl();
}

function buildQuoteMessage(pizzas) {
  const pizzaWord = pizzas === 1 ? "מגש אחד" : `${pizzas} מגשים`;
  return `היי ${CONFIG.quoteWhatsApp.contactName}, אני רוצה ${pizzaWord} לאירוע. תעשה לי מחיר טוב, אבל תמשיך באיכות הגבוהה שלכם 🍕`;
}

function updateCta(result) {
  const disabled = !result || result.totalParticipants === 0 || result.pizzas === 0;
  const pizzas = result?.pizzas ?? 0;

  const quoteLabel = pizzas > 0 ? `בקשת הצעת מחיר ל-${pizzas} מגשים` : "בקשת הצעת מחיר בוואטסאפ";
  const quoteHref = disabled
    ? "#"
    : `https://wa.me/${toWhatsAppNumber(CONFIG.quoteWhatsApp.localPhone)}?text=${encodeURIComponent(buildQuoteMessage(pizzas))}`;
  for (const cta of [refs.quoteCta, refs.stickyQuoteCta]) {
    cta.textContent = cta === refs.stickyQuoteCta ? "בקשת הצעת מחיר" : quoteLabel;
    cta.setAttribute("aria-disabled", String(disabled));
    cta.href = quoteHref;
  }

  // The order site sells the regular menu, not a quantity we can hand it —
  // so it always links plainly and never claims to carry the pizza count.
  refs.orderCta.href = CONFIG.orderUrl;
}

// ---------- sticky mobile bar ----------
// Shown only after the user has actually seen the result card and then
// scrolled it out of view — never on first load before they've reached it.
let resultOutOfView = false;
let hasSeenResult = false;
let inputFocused = false;

function updateStickyBar(result) {
  refs.stickyCount.textContent = result && result.pizzas > 0 ? `${result.pizzas} מגשים` : "—";
  refreshStickyVisibility();
}

function refreshStickyVisibility() {
  const shouldShow = hasSeenResult && resultOutOfView && !inputFocused
    && lastResult && lastResult.pizzas > 0 && !lastResult.isOversized;
  refs.stickyBar.hidden = !shouldShow;
}

const stickyObserver = new IntersectionObserver(
  ([entry]) => {
    if (entry.isIntersecting) hasSeenResult = true;
    resultOutOfView = !entry.isIntersecting;
    refreshStickyVisibility();
  },
  { threshold: 0 }
);
stickyObserver.observe(refs.resultCard);

document.addEventListener("focusin", (e) => {
  if (e.target.tagName === "INPUT") {
    inputFocused = true;
    refreshStickyVisibility();
  }
});
document.addEventListener("focusout", (e) => {
  if (e.target.tagName === "INPUT") {
    inputFocused = false;
    refreshStickyVisibility();
  }
});

// ---------- share / copy ----------
function buildShareText() {
  const labels = EVENT_TYPES[state.event];
  const pizzaWord = lastResult && lastResult.pizzas === 1 ? "מגש אחד" : `${lastResult?.pizzas ?? 0} מגשים`;
  const summary = labels.summary(state.childrenTotal, state.teensAndAdults);
  const otherMealPart = state.otherMeal ? "עם מנה משביעה נוספת." : "בלי אוכל משביע נוסף.";
  const link = buildShareUrl();
  let text = `תכנון הפיצה לאירוע 🍕\n${summary}: הערכה של ${pizzaWord}.\nתיאבון ${APPETITE_LABELS[state.appetite]}, ${otherMealPart}\nאפשר לראות ולעדכן את התכנון כאן: ${link}\nחושב במחשבון של ${CONFIG.brandName}. זו הערכה, לא הזמנה.`;
  if (CONFIG.product.price != null && lastResult) {
    text += `\nעלות משוערת: ${(CONFIG.product.price * lastResult.pizzas).toFixed(0)} ${CONFIG.product.currency}`;
  }
  return text;
}

refs.shareBtn.addEventListener("click", async () => {
  const text = buildShareText();
  if (navigator.share) {
    track("share_intent", { channel: "web-share" });
    try {
      await navigator.share({ text });
    } catch {
      /* user cancelled — not an error */
    }
    return;
  }
  track("share_intent", { channel: "whatsapp" });
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
});

refs.copyBtn.addEventListener("click", async () => {
  const text = buildShareText();
  try {
    await navigator.clipboard.writeText(text);
    track("copy_success", { type: "summary" });
  } catch {
    refs.copyFallback.hidden = false;
    refs.copyFallback.value = text;
    refs.copyFallback.focus();
    refs.copyFallback.select();
  }
});

refs.quoteCta.addEventListener("click", (e) => {
  if (refs.quoteCta.getAttribute("aria-disabled") === "true") e.preventDefault();
  track("quote_request_click", { pizzas: lastResult?.pizzas ?? 0 });
});
refs.stickyQuoteCta.addEventListener("click", (e) => {
  if (refs.stickyQuoteCta.getAttribute("aria-disabled") === "true") e.preventDefault();
  track("quote_request_click", { pizzas: lastResult?.pizzas ?? 0, source: "sticky" });
});
refs.orderCta.addEventListener("click", () => {
  track("order_click", { target: "menu", pizzas: lastResult?.pizzas ?? 0 });
});

// ---------- saved plans (localStorage) ----------
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function formatRelativeTime(isoString) {
  const diffMinutes = Math.round((new Date(isoString).getTime() - Date.now()) / 60000);
  const rtf = new Intl.RelativeTimeFormat("he", { numeric: "auto" });
  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, "hour");
  return rtf.format(Math.round(diffHours / 24), "day");
}

function planSummaryText(planState) {
  const labels = EVENT_TYPES[planState.event] ?? EVENT_TYPES.birthday;
  const r = calculatePizzas({
    youngChildren: planState.youngChildren,
    children: Math.max(0, planState.childrenTotal - planState.youngChildren),
    teensAndAdults: planState.teensAndAdults,
    appetite: planState.appetite,
    otherMeal: planState.otherMeal,
    extraPercent: planState.extraPercent,
    servingUnitsPerPizza: CONFIG.product.servingUnitsPerPizza,
    customRates: planState.customRates ?? null,
  });
  const pizzaWord = r.pizzas === 1 ? "מגש אחד" : `${r.pizzas} מגשים`;
  return `${labels.summary(planState.childrenTotal, planState.teensAndAdults)} · ${pizzaWord}`;
}

function planRowHtml(plan) {
  let summary = "תכנון שמור";
  try {
    summary = planSummaryText(plan.state);
  } catch {
    /* an older/foreign schema shouldn't break the whole list */
  }
  const safeName = escapeHtml(plan.name);
  return `
    <li class="saved-plan-item" data-id="${escapeHtml(plan.id)}">
      <div class="saved-plan-info">
        <div class="saved-plan-name">${safeName}</div>
        <div class="saved-plan-meta">${escapeHtml(summary)} · עודכן ${escapeHtml(formatRelativeTime(plan.updatedAt))}</div>
      </div>
      <div class="saved-plan-actions">
        <button type="button" class="load-btn" data-action="load" data-id="${escapeHtml(plan.id)}" aria-label="טעינת התכנית ${safeName}">טעינה</button>
        <button type="button" class="delete-btn" data-action="delete" data-id="${escapeHtml(plan.id)}" aria-label="מחיקת התכנית ${safeName}">🗑</button>
      </div>
    </li>`;
}

function renderSavedPlans() {
  const available = isStorageAvailable();
  refs.storageUnavailableNotice.hidden = available;
  refs.savePlanForm.hidden = !available;
  if (!available) {
    refs.savedPlansListHeading.hidden = true;
    refs.noPlansHint.hidden = true;
    refs.savedPlansList.innerHTML = "";
    return;
  }

  const plans = listPlans();
  refs.savedPlansListHeading.hidden = plans.length === 0;
  refs.savedPlansListHeading.textContent = `התכניות השמורות שלי (${plans.length})`;
  refs.noPlansHint.hidden = plans.length > 0;
  refs.savedPlansList.innerHTML = plans.map(planRowHtml).join("");
}

// ---------- "currently showing" plan chip ----------
// A visible, persistent label right on the result card itself — not a toast
// that scrolls away — so loading/saving a named plan is never a silent UI
// change. Cleared as soon as the user edits anything, since the chip would
// otherwise keep claiming to show a plan that no longer matches the inputs.
let activePlanName = null;

function setActivePlan(name) {
  activePlanName = name;
  refs.activePlanChip.hidden = false;
  refs.activePlanChip.textContent = `🔖 ${name}`;
}

function clearActivePlan() {
  if (activePlanName === null) return;
  activePlanName = null;
  refs.activePlanChip.hidden = true;
  refs.activePlanChip.textContent = "";
}

function loadPlan(plan) {
  state = { ...DEFAULTS, ...plan.state };
  isExample = false;
  hasStarted = true;

  refs.childrenInput.value = String(state.childrenTotal);
  refs.teensAdultsInput.value = String(state.teensAndAdults);
  refs.youngChildrenInput.value = String(state.youngChildren);
  refs.otherMealInput.checked = state.otherMeal;
  refs.extraPercentInput.checked = state.extraPercent;
  if (state.customRates) fillRateInputs(state.customRates);

  refs.sharedBanner.hidden = true;
  refs.linkErrorBanner.hidden = true;
  setActivePlan(plan.name);

  track("plan_load", {});
  render();
  refs.resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

refs.savePlanForm.addEventListener("submit", (e) => {
  e.preventDefault();
  try {
    // Store only the fields the calculator itself uses — never anything
    // derived from analytics or the URL — so a saved plan is exactly what
    // "load" needs to reconstruct the screen.
    const { event, childrenTotal, youngChildren, teensAndAdults, appetite, otherMeal, extraPercent, customRates } = state;
    const { plan, overwritten } = savePlan(refs.planNameInput.value, {
      event, childrenTotal, youngChildren, teensAndAdults, appetite, otherMeal, extraPercent, customRates,
    });
    refs.savePlanStatus.textContent = overwritten ? `עודכן: "${plan.name}"` : `נשמר: "${plan.name}"`;
    refs.savePlanStatus.classList.remove("is-error");
    refs.savePlanStatus.classList.add("is-success");
    refs.planNameInput.value = "";
    setActivePlan(plan.name);
    // Never send the plan's free-text name (it may name a child or a guest)
    // to analytics — only non-identifying counts.
    track("plan_save", { overwritten, savedCount: listPlans().length });
    renderSavedPlans();
  } catch (err) {
    if (err instanceof PlanValidationError || err instanceof StorageUnavailableError) {
      refs.savePlanStatus.textContent = err.message;
      refs.savePlanStatus.classList.remove("is-success");
      refs.savePlanStatus.classList.add("is-error");
    } else {
      throw err;
    }
  }
});

refs.savedPlansList.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const plan = getPlan(btn.dataset.id);
  if (!plan) return;

  if (btn.dataset.action === "delete") {
    if (window.confirm(`למחוק את "${plan.name}"?`)) {
      deletePlan(plan.id);
      track("plan_delete", { savedCount: listPlans().length });
      renderSavedPlans();
    }
  } else if (btn.dataset.action === "load") {
    loadPlan(plan);
  }
});

// ---------- input wiring ----------
let hasStarted = false;
function markStarted() {
  if (!hasStarted) {
    hasStarted = true;
    track("calculator_start", { event: state.event });
  }
  isExample = false;
  clearActivePlan();
}

function bindStepper(inputEl, min = 0) {
  const group = inputEl.closest(".stepper");
  group.querySelectorAll(".stepper-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const current = Number(inputEl.value) || 0;
      const next = btn.dataset.action === "inc" ? current + 1 : Math.max(min, current - 1);
      inputEl.value = String(next);
      markStarted();
      render();
    });
  });
  inputEl.addEventListener("input", () => {
    markStarted();
    render();
  });
}

bindStepper(refs.childrenInput);
bindStepper(refs.teensAdultsInput);
bindStepper(refs.youngChildrenInput);

refs.appetiteGroup.querySelectorAll(".segmented-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.appetite = btn.dataset.value;
    markStarted();
    render();
  });
});

refs.otherMealInput.addEventListener("change", () => {
  state.otherMeal = refs.otherMealInput.checked;
  markStarted();
  render();
});
refs.extraPercentInput.addEventListener("change", () => {
  state.extraPercent = refs.extraPercentInput.checked;
  markStarted();
  render();
});

function fillRateInputs(rates) {
  refs.youngChildRateInput.value = String(rates.youngChild);
  refs.childRateInput.value = String(rates.child);
  refs.teenAdultRateInput.value = String(rates.teenAdult);
}

refs.customRatesToggle.addEventListener("change", () => {
  state.customRates = refs.customRatesToggle.checked ? defaultRates(state.appetite) : null;
  if (state.customRates) fillRateInputs(state.customRates);
  markStarted();
  render();
});

for (const input of [refs.youngChildRateInput, refs.childRateInput, refs.teenAdultRateInput]) {
  input.addEventListener("input", () => {
    markStarted();
    render();
  });
}

refs.resetRatesBtn.addEventListener("click", () => {
  state.customRates = defaultRates(state.appetite);
  fillRateInputs(state.customRates);
  markStarted();
  render();
});

refs.eventGrid.querySelectorAll(".event-card").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.event = btn.dataset.event;
    clearActivePlan();
    // Switching event type never resets quantities the user already entered —
    // but while still showing the untouched example, jump to that event's own
    // sensible default (e.g. an office event defaults to 0 children).
    if (isExample) {
      const d = EVENT_TYPES[state.event].defaults;
      state.childrenTotal = d.childrenTotal;
      state.teensAndAdults = d.teensAndAdults;
      refs.childrenInput.value = String(d.childrenTotal);
      refs.teensAdultsInput.value = String(d.teensAndAdults);
    }
    render();
  });
});

// ---------- examples table ----------
function renderExamplesTable() {
  const counts = [10, 20, 30, 40];
  refs.examplesTableBody.innerHTML = counts
    .map((n) => {
      const r = calculatePizzas({ children: n, appetite: "normal", servingUnitsPerPizza: CONFIG.product.servingUnitsPerPizza });
      return `<tr><td>${n} משתתפים</td><td>רגיל</td><td>${r.pizzas} מגשים</td></tr>`;
    })
    .join("");
}

// ---------- boot ----------
// A URL that differs only by its fragment does not reload the page or
// re-run this module (browsers fire `hashchange` instead), so a shared link
// pasted into an already-open tab must be picked up via that event too.
function applyLocationState(isBoot = false) {
  const fragment = parseFragment();

  // A plain in-page anchor (skip link, footer "accessibility statement"
  // link, etc.) is not calculator state — leave whatever the user was
  // doing untouched and let the browser's native anchor-scroll happen.
  // The one exception is the very first load: there's nothing yet to
  // preserve, and the initial UI still needs its first render.
  if (fragment.isPlainAnchor && !isBoot) return;

  refs.sharedBanner.hidden = true;
  refs.linkErrorBanner.hidden = true;
  clearActivePlan();

  if (fragment.present && fragment.valid) {
    state = { ...DEFAULTS, ...fragment.state };
    isExample = false;
    hasStarted = true;
    refs.sharedBanner.hidden = false;
    track("shared_plan_open", { modelVersion: CONFIG.modelVersion });
  } else if (fragment.present && !fragment.valid) {
    state = { ...DEFAULTS };
    isExample = true;
    refs.linkErrorBanner.hidden = false;
  } else {
    state = { ...DEFAULTS };
    isExample = true;
  }

  refs.childrenInput.value = String(state.childrenTotal);
  refs.teensAdultsInput.value = String(state.teensAndAdults);
  refs.youngChildrenInput.value = String(state.youngChildren);
  refs.otherMealInput.checked = state.otherMeal;
  refs.extraPercentInput.checked = state.extraPercent;
  if (state.customRates) fillRateInputs(state.customRates);

  render();
}

// Not `addEventListener("hashchange", applyLocationState)` directly — that
// would pass the HashChangeEvent as `isBoot` (truthy), silently defeating
// the isBoot check below on every real hashchange.
window.addEventListener("hashchange", () => applyLocationState(false));

function boot() {
  refs.brandName.textContent = CONFIG.brandName;
  renderExamplesTable();
  renderSavedPlans();
  applyLocationState(true);
  track("calculator_view", {});
}

boot();
