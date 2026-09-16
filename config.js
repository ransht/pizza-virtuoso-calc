// Real business data, verified directly against https://pizzavirtuoso.co.il on 2026-09-16.
// Anything still unverified (menu/price mapping to event "trays") stays null — see the
// comment on `product` below before treating it as a real catalog entry.

export const CONFIG = {
  modelVersion: "1.0",
  catalogVersion: "unverified-1", // no confirmed catering/tray SKU yet — see `product`

  brandName: "פיצה וירטואוז",
  siteUrl: "https://pizzavirtuoso.co.il",
  orderUrl: "https://order.pizzavirtuoso.co.il",
  serviceAreas: ["ראשון לציון"],
  address: "ז׳בוטינסקי 16, ראשון לציון (מול היכל התרבות)",
  openingHours: "ראשון–חמישי, 17:00–23:00",
  restaurantPhone: "03-9504888",

  // Direct WhatsApp line for event/catering price-quote requests (not the
  // general restaurant landline above). Contact name is used in the message.
  quoteWhatsApp: {
    localPhone: "0542537257",
    contactName: "דניאל",
  },

  // The live menu sells individual pizzas in three sizes (M/L/XL) and single
  // slices — there is no published "event tray" SKU or bulk price list, so we
  // cannot derive a real price per calculator "tray" without guessing. This
  // entry stays a modeling placeholder (servingUnitsPerPizza=8 is our own
  // planning assumption, not a menu fact) until the business confirms how
  // they price group/event quantities. In the meantime, the calculator sends
  // the computed quantity straight to the business via WhatsApp for a real
  // quote instead of showing a fabricated price.
  product: {
    productId: "reference-tray",
    name: "מגש (הערכת תכנון פנימית)",
    servingUnitsPerPizza: 8,
    diameterCm: null,
    price: null,
    currency: "ILS",
    priceUpdatedAt: null,
  },

  deliveryFee: null,
  minimumOrder: null,
  largeOrderThreshold: 100,
};
