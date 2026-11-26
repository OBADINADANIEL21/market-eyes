export const config = { schedule: "0 6 * * *" };

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function supabaseGet(url, serviceKey, path) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!response.ok) throw new Error(`Supabase request failed (${response.status}): ${await response.text()}`);
  return response.json();
}

async function supabaseGetAll(url, serviceKey, path) {
  const pageSize = 1000;
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const separator = path.includes("?") ? "&" : "?";
    const page = await supabaseGet(url, serviceKey, `${path}${separator}limit=${pageSize}&offset=${offset}`);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

function topChanges(history, cutoff) {
  const groups = new Map();
  for (const point of history) {
    const listing = Array.isArray(point.prices) ? point.prices[0] : point.prices;
    if (!listing) continue;
    const key = String(point.price_id);
    if (!groups.has(key)) groups.set(key, { item: listing.item, market: listing.market, city: listing.city, points: [] });
    groups.get(key).points.push({ price: Number(point.price), time: new Date(point.captured_at).getTime() });
  }

  return [...groups.values()].flatMap((group) => {
    const points = group.points.filter((point) => Number.isFinite(point.price) && point.price > 0).sort((a, b) => a.time - b.time);
    const previous = points.filter((point) => point.time <= cutoff).at(-1);
    const current = points.filter((point) => point.time > cutoff).at(-1);
    if (!previous || !current || previous.price === current.price) return [];
    return [{ ...group, previous: previous.price, current: current.price, change: ((current.price - previous.price) / previous.price) * 100 }];
  }).sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 5);
}

export default async function dailyBrief() {
  const supabaseUrl = requiredEnv("SUPABASE_URL").replace(/\/+$/, "");
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const oneSignalAppId = requiredEnv("ONESIGNAL_APP_ID");
  const oneSignalApiKey = requiredEnv("ONESIGNAL_API_KEY");
  const publicSiteUrl = requiredEnv("PUBLIC_SITE_URL").replace(/\/+$/, "");
  const now = Date.now();
  const cutoff = now - 24 * 60 * 60 * 1000;
  const historyStart = now - 48 * 60 * 60 * 1000;
  const historyQuery = new URLSearchParams({
    select: "price_id,price,captured_at,prices!inner(item,market,city)",
    captured_at: `gte.${new Date(historyStart).toISOString()}`,
    order: "captured_at.asc",
  });
  const [recipients, history] = await Promise.all([
    supabaseGetAll(supabaseUrl, serviceKey, "profiles?select=id&notify_brief=eq.true"),
    supabaseGetAll(supabaseUrl, serviceKey, `price_history?${historyQuery}`),
  ]);
  if (!recipients.length) return new Response(JSON.stringify({ sent: 0, reason: "No subscribers opted in." }), { status: 200 });

  const changes = topChanges(history, cutoff);
  const summary = changes.length
    ? changes.map((item) => `${item.item} at ${item.market} ${item.change < 0 ? "down" : "up"} ${Math.abs(item.change).toFixed(0)}%`).join("; ")
    : "No verified price changes were recorded in the last 24 hours.";
  const ids = recipients.map((recipient) => recipient.id);
  for (let index = 0; index < ids.length; index += 2000) {
    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Key ${oneSignalApiKey}` },
      body: JSON.stringify({
        app_id: oneSignalAppId,
        target_channel: "push",
        include_aliases: { external_id: ids.slice(index, index + 2000) },
        headings: { en: "Your 7am Market Eye price brief" },
        contents: { en: summary.slice(0, 250) },
        data: { type: "daily-brief", url: "/brief" },
        url: `${publicSiteUrl}/brief`,
        ttl: 3600,
      }),
    });
    if (!response.ok) throw new Error(`OneSignal rejected the daily brief (${response.status}): ${await response.text()}`);
  }

  return new Response(JSON.stringify({ sent: ids.length, changes: changes.length }), { status: 200 });
}
