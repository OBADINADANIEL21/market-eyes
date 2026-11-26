import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useAuth } from "../context/AuthContext";
import { formatPrice } from "../data";
import { useLivePrices } from "../hooks/useLivePrices";
import { supabase } from "../lib/supabase";

const basketMatchers = [
  ["Rice", (item) => item.toLowerCase().startsWith("rice")],
  ["Tomatoes", (item) => item.toLowerCase().startsWith("tomato")],
  ["Garri", (item) => item.toLowerCase().startsWith("garri")],
];

function getHeatRows(prices) {
  const actual = prices.filter((entry) => entry.priceSource === "supabase");
  const latestByMarketVariant = new Map();
  for (const entry of actual) {
    const index = basketMatchers.findIndex(([, matches]) => matches(entry.item));
    if (index < 0) continue;
    const marketKey = `${entry.market}__${entry.city}`;
    const variant = `${entry.item.trim().toLowerCase()}__${String(entry.unit).trim().toLowerCase()}`;
    const key = `${marketKey}__${index}__${variant}`;
    const previous = latestByMarketVariant.get(key);
    if (!previous || new Date(entry.createdAt ?? 0) > new Date(previous.createdAt ?? 0)) {
      latestByMarketVariant.set(key, { entry, index, marketKey, variant });
    }
  }
  const variantsByItem = new Map();
  for (const row of latestByMarketVariant.values()) {
    if (!variantsByItem.has(row.index)) variantsByItem.set(row.index, new Map());
    const variants = variantsByItem.get(row.index);
    if (!variants.has(row.variant)) variants.set(row.variant, []);
    variants.get(row.variant).push(row);
  }
  const selectedVariants = new Map([...variantsByItem].map(([index, variants]) => {
    const best = [...variants.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))[0];
    return [index, best?.[1].length > 1 ? best[0] : null];
  }));
  const latestPrices = [...latestByMarketVariant.values()]
    .filter((row) => row.variant === selectedVariants.get(row.index));
  const averages = basketMatchers.map((_, index) => {
    const values = latestPrices.filter((row) => row.index === index).map(({ entry }) => entry.usdPrice);
    return values.length > 1 ? values.reduce((total, value) => total + value, 0) / values.length : null;
  });
  const groups = new Map();
  for (const { entry, marketKey } of latestPrices) {
    const key = marketKey;
    if (!groups.has(key)) groups.set(key, { market: entry.market, city: entry.city, items: new Map() });
    const group = groups.get(key);
    const index = basketMatchers.findIndex(([, matches]) => matches(entry.item));
    if (index < 0 || !Number.isFinite(averages[index]) || averages[index] <= 0) continue;
    group.items.set(index, entry);
  }
  const rows = [...groups.values()].map((group) => {
    const ratios = [...group.items.entries()].map(([index, entry]) => entry.usdPrice / averages[index]);
    const score = ratios.length === basketMatchers.length
      ? ratios.reduce((total, value) => total + value, 0) / ratios.length
      : null;
    return { ...group, score };
  });
  const mean = rows.filter((row) => row.score !== null).reduce((total, row, _, list) => total + row.score / list.length, 0);
  return rows.map((row) => ({
    ...row,
    level: row.score === null ? "incomplete" : row.score <= mean * 0.9 ? "cheap" : row.score >= mean * 1.1 ? "expensive" : "medium",
  })).sort((a, b) => (a.score ?? Infinity) - (b.score ?? Infinity));
}

const heatColor = { cheap: "#16a34a", medium: "#eab308", expensive: "#dc2626" };

export default function HeatMap() {
  const { prices, loading, loadingMore, hasMore, loadMore, dataSource } = useLivePrices();
  const { profile } = useAuth();
  const [locations, setLocations] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [coordinates, setCoordinates] = useState({ latitude: "", longitude: "" });
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const rows = useMemo(() => getHeatRows(prices), [prices]);

  const loadLocations = useCallback(async () => {
    if (!supabase) {
      setNotice("Market locations are unavailable because the database is not configured.");
      return;
    }
    const { data, error } = await supabase.from("markets")
      .select("id,name,city,country,latitude,longitude")
      .eq("country", "Nigeria");
    if (error) {
      console.error("Could not load market coordinates:", error);
      setNotice("Market locations could not be loaded. Check that the market-tools SQL migration has been run.");
      return;
    }
    setLocations(data ?? []);
    setNotice("");
  }, []);

  useEffect(() => { void loadLocations(); }, [loadLocations]);

  const selected = rows.find((row) => `${row.market}__${row.city}` === selectedKey);
  useEffect(() => {
    if (!selected) return;
    const saved = locations.find((location) => location.name === selected.market && location.city === selected.city);
    setCoordinates({
      latitude: saved?.latitude == null ? "" : String(saved.latitude),
      longitude: saved?.longitude == null ? "" : String(saved.longitude),
    });
  }, [selectedKey, locations, selected]);

  const markers = rows.flatMap((row) => {
    const location = locations.find((entry) => entry.name === row.market && entry.city === row.city);
    if (!Number.isFinite(Number(location?.latitude)) || !Number.isFinite(Number(location?.longitude)) || location?.latitude == null || location?.longitude == null) return [];
    return [{ ...row, latitude: Number(location.latitude), longitude: Number(location.longitude) }];
  });

  const saveCoordinates = async (event) => {
    event.preventDefault();
    if (profile?.role !== "admin" || !selected) return;
    const latitude = Number(coordinates.latitude);
    const longitude = Number(coordinates.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setNotice("Enter valid map coordinates: latitude -90 to 90 and longitude -180 to 180.");
      return;
    }
    setSaving(true);
    setNotice("");
    const { error } = await supabase.from("markets").upsert({
      name: selected.market,
      city: selected.city,
      country: "Nigeria",
      latitude,
      longitude,
    }, { onConflict: "name,country,city" });
    if (error) {
      console.error("Could not save market coordinates:", error);
      setNotice("Could not save coordinates. Confirm admin access and check the SQL migration.");
    } else {
      setNotice("Market coordinates saved.");
      await loadLocations();
    }
    setSaving(false);
  };

  return <main className="mx-auto max-w-6xl px-4 py-8">
    <h1 className="text-3xl font-extrabold">Market heat map</h1>
    <p className="mt-2 text-gray-600">Relative basket cost from approved rice, tomato, and garri listings. Pins appear only when an administrator adds verified market coordinates.</p>
    {dataSource !== "supabase" && !loading && <p role="status" className="my-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">No approved database prices are available. Estimates are not used in this heat map.</p>}
    {notice && <p role="status" className="my-4 rounded-xl bg-amber-50 p-3 text-amber-950">{notice}</p>}
    <div className="my-4 flex flex-wrap gap-3 text-sm font-semibold"><span className="text-green-700">● Cheaper</span><span className="text-yellow-700">● Near average</span><span className="text-red-700">● Costlier</span></div>
    <div className="h-[420px] overflow-hidden rounded-2xl border shadow">
      <MapContainer center={[9.08, 8.67]} zoom={6} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {markers.map((row) => <CircleMarker key={`${row.market}__${row.city}`} center={[row.latitude, row.longitude]} radius={12} pathOptions={{ color: heatColor[row.level] ?? "#6b7280", fillColor: heatColor[row.level] ?? "#6b7280", fillOpacity: 0.8 }}>
          <Popup><strong>{row.market}</strong><br />{row.city}<br />{row.level === "incomplete" ? "Not enough prices for basket score" : `${row.level} relative basket cost`}</Popup>
        </CircleMarker>)}
      </MapContainer>
    </div>
    {!markers.length && <p className="mt-2 text-sm text-gray-500">The map will show market pins after approved listings and verified coordinates are available.</p>}
    {loading && <p role="status" className="my-4">Loading approved market prices…</p>}
    {rows.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => <article key={`${row.market}__${row.city}`} className={`rounded-xl border-l-4 bg-white p-4 shadow ${row.level === "cheap" ? "border-green-600" : row.level === "expensive" ? "border-red-600" : row.level === "medium" ? "border-yellow-500" : "border-gray-300"}`}>
        <h2 className="font-bold">{row.market}</h2><p className="text-sm text-gray-500">{row.city}</p>
        <p className="mt-2 text-sm font-semibold capitalize">{row.level === "incomplete" ? "Not enough comparable prices" : `${row.level} relative basket cost`}</p>
        {profile?.role === "admin" && <button type="button" onClick={() => setSelectedKey(`${row.market}__${row.city}`)} className="mt-2 text-sm font-bold text-brand">Set map coordinates</button>}
      </article>)}
    </div> : !loading && <p className="mt-5 rounded-2xl bg-white p-6 text-gray-600 shadow">No approved market prices are available for the basket yet.</p>}
    {profile?.role === "admin" && selected && <form onSubmit={saveCoordinates} className="mt-6 grid gap-3 rounded-2xl bg-white p-5 shadow sm:grid-cols-3">
      <h2 className="font-bold sm:col-span-3">Map location for {selected.market}, {selected.city}</h2>
      <label className="text-sm font-semibold">Latitude<input required type="number" min="-90" max="90" step="any" value={coordinates.latitude} onChange={(event) => setCoordinates((current) => ({ ...current, latitude: event.target.value }))} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
      <label className="text-sm font-semibold">Longitude<input required type="number" min="-180" max="180" step="any" value={coordinates.longitude} onChange={(event) => setCoordinates((current) => ({ ...current, longitude: event.target.value }))} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
      <button disabled={saving} className="self-end rounded-xl bg-brand px-4 py-2 font-bold text-white disabled:opacity-50">{saving ? "Saving…" : "Save coordinates"}</button>
    </form>}
    {hasMore && <button type="button" disabled={loadingMore} onClick={() => void loadMore()} className="mt-5 rounded-xl border px-4 py-3 font-bold">{loadingMore ? "Loading…" : "Load more listings"}</button>}
  </main>;
}
