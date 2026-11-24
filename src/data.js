// MARKET EYE - Global Market Price Data
// Demo price estimates. These values are not current market observations.
// `prices` adds stable ids and illustrative history for the demo UI.

const rawPrices = [
  // ===== LAGOS, NIGERIA =====
  { item: "Rice (50kg)", country: "Nigeria", city: "Lagos", market: "Mile 12 Market", price: 78000, currency: "NGN", trend: "up", verifiedCount: 214 },
  { item: "Rice (50kg)", country: "Nigeria", city: "Lagos", market: "Daleko Market", price: 74500, currency: "NGN", trend: "up", verifiedCount: 187 },
  { item: "Rice (50kg)", country: "Nigeria", city: "Lagos", market: "Oyingbo Market", price: 76000, currency: "NGN", trend: "up", verifiedCount: 156 },
  { item: "Tomatoes (1kg)", country: "Nigeria", city: "Lagos", market: "Mile 12 Market", price: 1200, currency: "NGN", trend: "down", verifiedCount: 342 },
  { item: "Tomatoes (1kg)", country: "Nigeria", city: "Lagos", market: "Daleko Market", price: 1050, currency: "NGN", trend: "down", verifiedCount: 189 },
  { item: "Onions (1kg)", country: "Nigeria", city: "Lagos", market: "Mile 12 Market", price: 900, currency: "NGN", trend: "down", verifiedCount: 276 },
  { item: "Eggs (Crate of 30)", country: "Nigeria", city: "Lagos", market: "Oyingbo Market", price: 3800, currency: "NGN", trend: "up", verifiedCount: 401 },
  { item: "Eggs (Crate of 30)", country: "Nigeria", city: "Lagos", market: "Ketu Market", price: 3650, currency: "NGN", trend: "up", verifiedCount: 145 },
  { item: "Bread (Loaf)", country: "Nigeria", city: "Lagos", market: "Ojota Market", price: 1000, currency: "NGN", trend: "up", verifiedCount: 220 },
  { item: "Chicken (1kg)", country: "Nigeria", city: "Lagos", market: "Balogun Market", price: 4500, currency: "NGN", trend: "up", verifiedCount: 198 },
  { item: "Chicken (1kg)", country: "Nigeria", city: "Lagos", market: "Ketu Market", price: 4200, currency: "NGN", trend: "up", verifiedCount: 167 },

  // ===== IBADAN, NIGERIA =====
  { item: "Rice (50kg)", country: "Nigeria", city: "Ibadan", market: "Oja Oba Market", price: 70000, currency: "NGN", trend: "up", verifiedCount: 178 },
  { item: "Rice (50kg)", country: "Nigeria", city: "Ibadan", market: "Bodija Market", price: 71500, currency: "NGN", trend: "up", verifiedCount: 132 },
  { item: "Tomatoes (1kg)", country: "Nigeria", city: "Ibadan", market: "Bodija Market", price: 1000, currency: "NGN", trend: "down", verifiedCount: 211 },
  { item: "Onions (1kg)", country: "Nigeria", city: "Ibadan", market: "Oja Oba Market", price: 700, currency: "NGN", trend: "down", verifiedCount: 245 },
  { item: "Eggs (Crate of 30)", country: "Nigeria", city: "Ibadan", market: "Oje Market", price: 3400, currency: "NGN", trend: "up", verifiedCount: 154 },
  { item: "Bread (Loaf)", country: "Nigeria", city: "Ibadan", market: "Dugbe Market", price: 900, currency: "NGN", trend: "up", verifiedCount: 118 },
  { item: "Chicken (1kg)", country: "Nigeria", city: "Ibadan", market: "Bodija Market", price: 4000, currency: "NGN", trend: "up", verifiedCount: 143 },

  // ===== NAIROBI, KENYA =====
  { item: "Rice (50kg)", country: "Kenya", city: "Nairobi", market: "Marikiti Market", price: 8500, currency: "KES", trend: "up", verifiedCount: 265 },
  { item: "Rice (50kg)", country: "Kenya", city: "Nairobi", market: "City Market", price: 8900, currency: "KES", trend: "up", verifiedCount: 172 },
  { item: "Tomatoes (1kg)", country: "Kenya", city: "Nairobi", market: "Marikiti Market", price: 180, currency: "KES", trend: "down", verifiedCount: 324 },
  { item: "Tomatoes (1kg)", country: "Kenya", city: "Nairobi", market: "Gikomba Market", price: 155, currency: "KES", trend: "down", verifiedCount: 287 },
  { item: "Onions (1kg)", country: "Kenya", city: "Nairobi", market: "Marikiti Market", price: 120, currency: "KES", trend: "down", verifiedCount: 298 },
  { item: "Eggs (Crate of 30)", country: "Kenya", city: "Nairobi", market: "City Market", price: 450, currency: "KES", trend: "up", verifiedCount: 356 },
  { item: "Eggs (Crate of 30)", country: "Kenya", city: "Nairobi", market: "Gikomba Market", price: 420, currency: "KES", trend: "up", verifiedCount: 190 },
  { item: "Bread (Loaf)", country: "Kenya", city: "Nairobi", market: "City Market", price: 70, currency: "KES", trend: "up", verifiedCount: 210 },
  { item: "Chicken (1kg)", country: "Kenya", city: "Nairobi", market: "Gikomba Market", price: 600, currency: "KES", trend: "up", verifiedCount: 233 },

  // ===== MUMBAI, INDIA =====
  { item: "Rice (50kg)", country: "India", city: "Mumbai", market: "APMC Vashi Market", price: 3500, currency: "INR", trend: "down", verifiedCount: 189 },
  { item: "Rice (50kg)", country: "India", city: "Mumbai", market: "Crawford Market", price: 3750, currency: "INR", trend: "down", verifiedCount: 142 },
  { item: "Tomatoes (1kg)", country: "India", city: "Mumbai", market: "APMC Vashi Market", price: 60, currency: "INR", trend: "up", verifiedCount: 405 },
  { item: "Onions (1kg)", country: "India", city: "Mumbai", market: "APMC Vashi Market", price: 40, currency: "INR", trend: "down", verifiedCount: 378 },
  { item: "Onions (1kg)", country: "India", city: "Mumbai", market: "Crawford Market", price: 48, currency: "INR", trend: "down", verifiedCount: 156 },
  { item: "Eggs (Crate of 30)", country: "India", city: "Mumbai", market: "Crawford Market", price: 210, currency: "INR", trend: "up", verifiedCount: 267 },
  { item: "Bread (Loaf)", country: "India", city: "Mumbai", market: "Crawford Market", price: 45, currency: "INR", trend: "up", verifiedCount: 194 },
  { item: "Chicken (1kg)", country: "India", city: "Mumbai", market: "Crawford Market", price: 280, currency: "INR", trend: "up", verifiedCount: 312 },

  // ===== MANILA, PHILIPPINES =====
  { item: "Rice (50kg)", country: "Philippines", city: "Manila", market: "Quiapo Market", price: 2600, currency: "PHP", trend: "up", verifiedCount: 156 },
  { item: "Rice (50kg)", country: "Philippines", city: "Manila", market: "Divisoria Market", price: 2450, currency: "PHP", trend: "up", verifiedCount: 203 },
  { item: "Tomatoes (1kg)", country: "Philippines", city: "Manila", market: "Quiapo Market", price: 120, currency: "PHP", trend: "down", verifiedCount: 178 },
  { item: "Onions (1kg)", country: "Philippines", city: "Manila", market: "Divisoria Market", price: 140, currency: "PHP", trend: "up", verifiedCount: 231 },
  { item: "Eggs (Crate of 30)", country: "Philippines", city: "Manila", market: "Quiapo Market", price: 220, currency: "PHP", trend: "up", verifiedCount: 265 },
  { item: "Bread (Loaf)", country: "Philippines", city: "Manila", market: "Divisoria Market", price: 80, currency: "PHP", trend: "up", verifiedCount: 149 },
  { item: "Chicken (1kg)", country: "Philippines", city: "Manila", market: "Quiapo Market", price: 190, currency: "PHP", trend: "down", verifiedCount: 288 },

  // ===== NEW YORK, USA =====
  { item: "Rice (50kg)", country: "USA", city: "New York", market: "Chinatown Supermarket", price: 65, currency: "USD", trend: "up", verifiedCount: 98 },
  { item: "Rice (50kg)", country: "USA", city: "New York", market: "Essex Street Market", price: 72, currency: "USD", trend: "up", verifiedCount: 76 },
  { item: "Tomatoes (1kg)", country: "USA", city: "New York", market: "Union Square Greenmarket", price: 5, currency: "USD", trend: "down", verifiedCount: 134 },
  { item: "Onions (1kg)", country: "USA", city: "New York", market: "Essex Street Market", price: 3.5, currency: "USD", trend: "down", verifiedCount: 121 },
  { item: "Eggs (Crate of 30)", country: "USA", city: "New York", market: "Essex Street Market", price: 12, currency: "USD", trend: "up", verifiedCount: 187 },
  { item: "Bread (Loaf)", country: "USA", city: "New York", market: "Union Square Greenmarket", price: 4, currency: "USD", trend: "up", verifiedCount: 156 },
  { item: "Chicken (1kg)", country: "USA", city: "New York", market: "Chinatown Supermarket", price: 6, currency: "USD", trend: "down", verifiedCount: 143 },

  // ===== ACCRA, GHANA =====
  { item: "Rice (50kg)", country: "Ghana", city: "Accra", market: "Makola Market", price: 1450, currency: "GHS", trend: "up", verifiedCount: 84 },
  { item: "Tomatoes (1kg)", country: "Ghana", city: "Accra", market: "Agbogbloshie Market", price: 28, currency: "GHS", trend: "down", verifiedCount: 96 },
  { item: "Onions (1kg)", country: "Ghana", city: "Accra", market: "Makola Market", price: 22, currency: "GHS", trend: "stable", verifiedCount: 72 },
  { item: "Eggs (Crate of 30)", country: "Ghana", city: "Accra", market: "Kaneshie Market", price: 65, currency: "GHS", trend: "up", verifiedCount: 61 },

  // ===== JOHANNESBURG, SOUTH AFRICA =====
  { item: "Rice (50kg)", country: "South Africa", city: "Johannesburg", market: "Joburg Market", price: 1050, currency: "ZAR", trend: "up", verifiedCount: 78 },
  { item: "Tomatoes (1kg)", country: "South Africa", city: "Johannesburg", market: "Joburg Market", price: 24, currency: "ZAR", trend: "down", verifiedCount: 93 },
  { item: "Onions (1kg)", country: "South Africa", city: "Johannesburg", market: "Faraday Market", price: 20, currency: "ZAR", trend: "stable", verifiedCount: 67 },
  { item: "Eggs (Crate of 30)", country: "South Africa", city: "Johannesburg", market: "Bara Market", price: 78, currency: "ZAR", trend: "up", verifiedCount: 81 },

  // ===== LONDON, UNITED KINGDOM =====
  { item: "Rice (50kg)", country: "United Kingdom", city: "London", market: "New Spitalfields Market", price: 48, currency: "GBP", trend: "up", verifiedCount: 64 },
  { item: "Tomatoes (1kg)", country: "United Kingdom", city: "London", market: "Borough Market", price: 3.2, currency: "GBP", trend: "down", verifiedCount: 89 },
  { item: "Onions (1kg)", country: "United Kingdom", city: "London", market: "New Spitalfields Market", price: 1.6, currency: "GBP", trend: "stable", verifiedCount: 53 },
  { item: "Eggs (Crate of 30)", country: "United Kingdom", city: "London", market: "Borough Market", price: 8.5, currency: "GBP", trend: "up", verifiedCount: 74 },

  // ===== TORONTO, CANADA =====
  { item: "Rice (50kg)", country: "Canada", city: "Toronto", market: "St. Lawrence Market", price: 88, currency: "CAD", trend: "up", verifiedCount: 58 },
  { item: "Tomatoes (1kg)", country: "Canada", city: "Toronto", market: "Kensington Market", price: 5.2, currency: "CAD", trend: "down", verifiedCount: 71 },
  { item: "Onions (1kg)", country: "Canada", city: "Toronto", market: "St. Lawrence Market", price: 2.8, currency: "CAD", trend: "stable", verifiedCount: 46 },
  { item: "Eggs (Crate of 30)", country: "Canada", city: "Toronto", market: "Kensington Market", price: 11, currency: "CAD", trend: "up", verifiedCount: 62 },

  // ===== SYDNEY, AUSTRALIA =====
  { item: "Rice (50kg)", country: "Australia", city: "Sydney", market: "Paddy's Markets", price: 96, currency: "AUD", trend: "up", verifiedCount: 49 },
  { item: "Tomatoes (1kg)", country: "Australia", city: "Sydney", market: "Sydney Fish Market", price: 6.5, currency: "AUD", trend: "down", verifiedCount: 57 },
  { item: "Onions (1kg)", country: "Australia", city: "Sydney", market: "Paddy's Markets", price: 3.4, currency: "AUD", trend: "stable", verifiedCount: 42 },
  { item: "Eggs (Crate of 30)", country: "Australia", city: "Sydney", market: "Paddy's Markets", price: 13, currency: "AUD", trend: "up", verifiedCount: 51 },

  // ===== SAO PAULO, BRAZIL =====
  { item: "Rice (50kg)", country: "Brazil", city: "Sao Paulo", market: "CEAGESP", price: 310, currency: "BRL", trend: "up", verifiedCount: 68 },
  { item: "Tomatoes (1kg)", country: "Brazil", city: "Sao Paulo", market: "CEAGESP", price: 8, currency: "BRL", trend: "down", verifiedCount: 77 },
  { item: "Onions (1kg)", country: "Brazil", city: "Sao Paulo", market: "Mercadao", price: 6, currency: "BRL", trend: "stable", verifiedCount: 55 },
  { item: "Eggs (Crate of 30)", country: "Brazil", city: "Sao Paulo", market: "CEAGESP", price: 24, currency: "BRL", trend: "up", verifiedCount: 63 },
];

// ===== Helpers: deterministic "random" numbers =====
// Seeded so the history chart and verification counts are the same on every
// render and every reload (no Math.random in the UI).
const hashString = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const seededRandom = (seed) => {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Build 7 daily prices (oldest -> newest). The last value is the current
 * price. Walking backwards, rising items start lower and falling items start
 * higher, with a little daily noise so the bars look natural.
 */
const buildHistory = (entry) => {
  const rand = seededRandom(hashString(`${entry.item}|${entry.city}|${entry.market}`));
  const drift = entry.trend === "up" ? 0.012 : -0.012;
  const round = (n) => (n >= 100 ? Math.round(n) : Math.round(n * 100) / 100);

  const days = [entry.price];
  for (let i = 1; i < 7; i++) {
    const step = drift + (rand() - 0.5) * 0.03;
    days.unshift(round(days[0] / (1 + step)));
  }
  return days;
};

// ===== Main export: every price, enriched =====
export const prices = rawPrices.map((p, i) => {
  return {
    ...p,
    id: `${p.city}-${i}`,
    verifiedCount: 0,
    verifiedToday: 0,
    history: buildHistory(p),
  };
});

// ===== Item emojis =====
// Keyed by short item name (used for the quick-pick chips in Search).
export const itemEmoji = {
  Rice: "🍚",
  Tomatoes: "🍅",
  Onions: "🧅",
  Eggs: "🥚",
  Bread: "🍞",
  Chicken: "🍗",
  Garri: "🍠",
  Beans: "🫘",
  Plantain: "🍌",
  Wheat: "🌾",
  Maize: "🌽",
};

// Emoji for a full item name such as "Rice (50kg)"
export const getItemEmoji = (item) => {
  const match = Object.keys(itemEmoji).find((name) => item.startsWith(name));
  return match ? itemEmoji[match] : "🛒";
};

export const cityFlags = {
  Lagos: "🇳🇬",
  Ibadan: "🇳🇬",
  Nairobi: "🇰🇪",
  Mumbai: "🇮🇳",
  Manila: "🇵🇭",
  "New York": "🇺🇸",
  Accra: "🇬🇭",
  Johannesburg: "🇿🇦",
  London: "🇬🇧",
  Toronto: "🇨🇦",
  Sydney: "🇦🇺",
  "Sao Paulo": "🇧🇷",
};

// ===== Leaderboard: "Top Reporters This Week" =====
export const leaderboard = [
  { name: "Mama Nkechi", city: "Lagos", reports: 15 },
  { name: "Raj", city: "Mumbai", reports: 12 },
  { name: "Wanjiru", city: "Nairobi", reports: 10 },
  { name: "Maria", city: "Manila", reports: 9 },
  { name: "Tunde", city: "Ibadan", reports: 7 },
];

// ===== Currency =====
// Fixed USD conversion rates
export const usdRates = {
  NGN: 1500,
  KES: 130,
  INR: 83,
  PHP: 58,
  GHS: 15,
  ZAR: 18,
  GBP: 0.79,
  CAD: 1.37,
  AUD: 1.53,
  BRL: 5.8,
  USD: 1,
};

export const currencySymbols = {
  NGN: "₦",
  KES: "KSh",
  INR: "₹",
  PHP: "₱",
  GHS: "GH₵",
  ZAR: "R",
  GBP: "£",
  CAD: "C$",
  AUD: "A$",
  BRL: "R$",
  USD: "$",
};

export const formatPrice = (price, currency) => {
  const symbol = currencySymbols[currency] || "";
  const formatted =
    price >= 1000
      ? Math.round(price).toLocaleString("en-US")
      : price.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return `${symbol} ${formatted}`;
};

export const toUSD = (price, currency) => {
  const rate = usdRates[currency];
  return rate ? price / rate : price;
};
