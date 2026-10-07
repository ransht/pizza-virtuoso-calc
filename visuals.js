// Presentation-only helpers for the result ticket: the rolling tray count and
// the row of pizzas. Nothing here computes a quantity — it only draws what
// calc.js already decided, so it can never disagree with the announced result.

const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_PIZZAS_SHOWN = 24;
const DEFAULT_WEDGES = 8;

const point = (radius, degrees) => {
  const rad = (degrees * Math.PI) / 180;
  return `${(50 + radius * Math.cos(rad)).toFixed(2)} ${(50 + radius * Math.sin(rad)).toFixed(2)}`;
};

// One top-down pizza, drawn as separate wedges so the last tray can show how
// much of it the guests actually need. Toppings are basil and tomato only —
// the pizzeria is kosher-dairy, so nothing that reads as meat.
function pizzaMarkup(wedges) {
  const step = 360 / wedges;
  let slices = "";
  for (let i = 0; i < wedges; i++) {
    const from = -90 + i * step;
    const mid = from + step / 2;
    const topping = i % 2 === 0
      ? `<ellipse class="pz-basil" cx="0" cy="0" rx="6" ry="3.2" transform="translate(${point(25, mid)}) rotate(${mid + 35})"/>`
      : `<circle class="pz-tomato" r="3.6" transform="translate(${point(24, mid)})"/>`;
    slices += `<g class="pz-wedge"><path d="M50 50L${point(39, from)}A39 39 0 0 1 ${point(39, from + step)}Z"/>${topping}</g>`;
  }
  return `<circle class="pz-crust" cx="50" cy="50" r="48"/><circle class="pz-sauce" cx="50" cy="50" r="42"/>${slices}`;
}

/**
 * @param {HTMLElement} container flex row the pizzas are drawn into
 * @returns {(view: {pizzas:number, plannedDemand:number, servingUnitsPerPizza:number}|null) => void}
 */
export function createTrayViz(container) {
  let wedges = DEFAULT_WEDGES;

  function makePizza() {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("class", "pz is-entering");
    svg.setAttribute("focusable", "false");
    svg.innerHTML = pizzaMarkup(wedges);
    svg.addEventListener("animationend", () => svg.classList.remove("is-entering"), { once: true });
    return svg;
  }

  function removePizza(svg) {
    svg.classList.add("is-leaving");
    const drop = () => svg.remove();
    svg.addEventListener("animationend", drop, { once: true });
    setTimeout(drop, 400); // reduced-motion / background-tab safety net
  }

  return function update(view) {
    container.querySelector(".pz-more")?.remove();

    const count = view?.pizzas ?? 0;
    const shown = Math.min(count, MAX_PIZZAS_SHOWN);

    // A tray modelled with an unusual unit count still gets one wedge per unit
    // when that's drawable; otherwise fall back to a plain 8-cut picture.
    const units = view?.servingUnitsPerPizza ?? DEFAULT_WEDGES;
    const nextWedges = units >= 4 && units <= 12 ? units : DEFAULT_WEDGES;
    if (nextWedges !== wedges) {
      wedges = nextWedges;
      container.replaceChildren();
    }

    const live = [...container.querySelectorAll(".pz:not(.is-leaving)")];
    for (let i = live.length; i < shown; i++) live.push(container.appendChild(makePizza()));
    while (live.length > shown) removePizza(live.pop());

    container.dataset.size = shown <= 4 ? "l" : shown <= 8 ? "m" : shown <= 16 ? "s" : "xs";
    container.hidden = shown === 0;
    if (shown === 0) return;

    // Only the final tray can be partly spare, and only when every tray is on
    // screen (otherwise the "last" drawn pizza isn't really the last one).
    let needed = wedges;
    if (count === shown) {
      const usedUnits = view.plannedDemand - (count - 1) * units;
      needed = Math.min(wedges, Math.max(1, Math.ceil((usedUnits / units) * wedges - 1e-9)));
    }
    live.forEach((svg, index) => {
      const isLast = index === live.length - 1;
      [...svg.querySelectorAll(".pz-wedge")].forEach((wedge, w) => {
        wedge.classList.toggle("is-spare", isLast && w >= needed);
      });
    });

    if (count > shown) {
      const more = document.createElement("span");
      more.className = "pz-more";
      more.textContent = `+${count - shown}`;
      container.append(more);
    }
  };
}

/**
 * Rolls the big number up or down when it changes, and stays put otherwise —
 * so typing that doesn't move the recommendation doesn't make the card twitch.
 * @param {HTMLElement} host element holding a single `.count-val` child
 */
export function createCounter(host) {
  let current = host.textContent.trim();

  return function set(text, direction = 0) {
    if (text === current) return;
    current = text;

    host.querySelectorAll(".count-val.is-leaving").forEach((node) => node.remove());
    const previous = host.querySelector(".count-val");
    const next = document.createElement("span");
    next.className = "count-val";
    next.textContent = text;

    if (previous && direction !== 0) {
      const way = direction > 0 ? "up" : "down";
      next.classList.add(`enter-${way}`);
      previous.classList.add("is-leaving", `leave-${way}`);
      const drop = () => previous.remove();
      previous.addEventListener("animationend", drop, { once: true });
      setTimeout(drop, 500);
      next.addEventListener("animationend", () => next.classList.remove(`enter-${way}`), { once: true });
    } else {
      previous?.remove();
    }
    host.append(next);
  };
}
