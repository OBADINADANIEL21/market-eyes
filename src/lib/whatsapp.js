export function normalizeNigerianWhatsApp(value) {
  const compact = value.trim().replace(/[\s()-]/g, "");
  return /^\+234\d{10}$/.test(compact) ? compact : null;
}

export function normalizeHttpsUrl(value) {
  if (!value.trim()) return "";
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
