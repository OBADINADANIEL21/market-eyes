import { useMemo, useState } from "react";
import { formatPrice } from "../data";
import { useLivePrices } from "../hooks/useLivePrices";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

const markets = ["Mile 12 Market", "Oshodi", "Ibafo", "Arepo", "Magboro"];
const inputClass = "w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3";

export default function Markets() {
  const { prices, loading, loadingMore, hasMore, loadMore, rates } = useLivePrices();
  const { user } = useAuth();
  const [tab, setTab] = useState("all");
  const [market, setMarket] = useState("");
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertForm, setAlertForm] = useState({ item: "", market: "", target_price: "", currency: "NGN", contact: "" });
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [transport, setTransport] = useState({ item: "", location: "", market: "", fare: "" });

  const filtered = useMemo(() => prices.filter((price) => !market || price.market.toLowerCase().includes(market.toLowerCase())), [prices, market]);
  const itemPrices = useMemo(() => {
    const groups = new Map();
    filtered.forEach((entry) => {
      const current = groups.get(entry.item) ?? [];
      groups.set(entry.item, [...current, entry]);
    });
    return [...groups.entries()];
  }, [filtered]);

  const trueCosts = useMemo(() => {
    const fareNgn = Number(transport.fare);
    if (!Number.isFinite(fareNgn) || fareNgn < 0) return [];
    return filtered
      .filter((entry) =>
        (!transport.item || entry.item === transport.item) &&
        (!transport.location || entry.city.toLowerCase().includes(transport.location.toLowerCase())) &&
        (!transport.market || entry.market === transport.market)
      )
      .map((entry) => ({ ...entry, trueCost: entry.price + (fareNgn / (rates.NGN || 1)) * (rates[entry.currency] || 1) }))
      .sort((a, b) => a.trueCost / (rates[a.currency] || 1) - b.trueCost / (rates[b.currency] || 1));
  }, [filtered, transport, rates]);

  const saveAlert = async (event) => {
    event.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setNotice("");
    try {
      const { error } = await supabase.from("alerts").insert({
        user_id: user?.id ?? null,
        item: alertForm.item.trim(),
        market: alertForm.market.trim(),
        target_price: Number(alertForm.target_price),
        contact: alertForm.contact.trim(),
        currency: "NGN",
      });
      if (error) throw error;
      setAlertOpen(false);
      setAlertForm({ item: "", market: "", target_price: "", currency: "NGN", contact: "" });
      setNotice("Alert Set! We’ll notify you when this listing reaches your target.");
    } catch (error) {
      console.error("Could not save price alert:", error);
      setNotice("Could not save your alert. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-extrabold">Markets</h1><p className="mt-1 text-gray-500">Compare available listings and estimate your transport-inclusive cost.</p></div>
        <button onClick={() => setAlertOpen(true)} className="rounded-xl bg-brand px-4 py-3 font-bold text-white">Set Price Alert</button>
      </header>
      {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-emerald-900">{notice}</p>}

      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Market listings">
        {[["all", "All Items"], ["market", "By Market"]].map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`rounded-full px-4 py-2 font-semibold ${tab === key ? "bg-brand text-white" : "bg-white text-gray-700"}`}>{label}</button>
        ))}
        {tab === "market" && <select aria-label="Choose a market" className={`${inputClass} max-w-sm`} value={market} onChange={(event) => setMarket(event.target.value)}>
          <option value="">All markets</option>{[...new Set([...markets, ...prices.map((entry) => entry.market)])].map((name) => <option key={name}>{name}</option>)}
        </select>}
      </div>

      {loading && <p role="status" className="mb-4 text-gray-500">Loading market prices…</p>}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {itemPrices.map(([item, entries]) => entries.map((entry) => (
          <article key={entry.id} className="rounded-2xl bg-white p-5 shadow">
            <h2 className="font-bold">{item}</h2><p className="text-sm text-gray-500">{entry.market} · {entry.city}</p>
            <p className="mt-2 text-xl font-extrabold text-brand">{formatPrice(entry.price, entry.currency)}</p>
            <p className="text-xs text-amber-800">{entry.priceSource === "supabase" ? "Community listing · confirm before purchase" : "Estimate · not a verified market quote"}</p>
          </article>
        )))}
      </div>
      {hasMore && <button disabled={loadingMore} onClick={() => void loadMore()} className="my-5 rounded-xl border px-5 py-3 font-bold">{loadingMore ? "Loading…" : "Load more prices"}</button>}
      {!filtered.length && !loading && <p className="rounded-xl bg-white p-5 text-gray-600">No matching price listings yet.</p>}

      <section className="mt-10 rounded-3xl bg-white p-5 shadow">
        <h2 className="text-2xl font-extrabold">Transport cost calculator</h2>
        <p className="mb-4 text-sm text-gray-500">Transport fares are entered in NGN and converted using current exchange rates. Results are estimates; confirm local transport costs.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-semibold">Item<select className={inputClass} value={transport.item} onChange={(event) => setTransport((prev) => ({ ...prev, item: event.target.value }))}><option value="">All items</option>{[...new Set(filtered.map((entry) => entry.item))].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="text-sm font-semibold">Your location<input className={inputClass} value={transport.location} onChange={(event) => setTransport((prev) => ({ ...prev, location: event.target.value }))} placeholder="City or area" /></label>
          <label className="text-sm font-semibold">Market<select className={inputClass} value={transport.market} onChange={(event) => setTransport((prev) => ({ ...prev, market: event.target.value }))}><option value="">All markets</option>{[...new Set(filtered.map((entry) => entry.market))].map((name) => <option key={name}>{name}</option>)}</select></label>
          <label className="text-sm font-semibold">Transport fare (NGN)<input className={inputClass} type="number" min="0" value={transport.fare} onChange={(event) => setTransport((prev) => ({ ...prev, fare: event.target.value }))} placeholder="Fare in naira" /></label>
        </div>
        {!!transport.fare && trueCosts.length > 0 && <div className="mt-4 space-y-2">{trueCosts.slice(0, 5).map((entry, index) => <p key={entry.id} className={`rounded-lg p-3 ${index === 0 ? "bg-emerald-100 font-bold text-emerald-900" : "bg-gray-50"}`}>{index === 0 ? "CHEAPEST TRUE COST · " : ""}{entry.item} at {entry.market}: {formatPrice(entry.trueCost, entry.currency)}</p>)}</div>}
      </section>

      {alertOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAlertOpen(false); }}>
        <form onSubmit={saveAlert} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="text-2xl font-bold">Set a price alert</h2>
          {[
            ["item", "Item", "e.g. Rice (50kg)", "text"],
            ["market", "Market", "e.g. Mile 12 Market", "text"],
            ["target_price", "Target price (NGN)", "", "number"],
            ["contact", "Phone or email", "Where should we contact you?", "text"],
          ].map(([name, label, placeholder, type]) => <label key={name} className="block text-sm font-semibold">{label}<input required className={inputClass} type={type} min={type === "number" ? "0.01" : undefined} value={alertForm[name]} placeholder={placeholder} onChange={(event) => setAlertForm((prev) => ({ ...prev, [name]: event.target.value }))} /></label>)}
          <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">Nigeria · NGN (Naira)</p>
          <p className="text-xs text-gray-500">Alerts are saved to your account. Delivery needs push or email notification setup.</p>
          <div className="flex gap-2"><button type="button" onClick={() => setAlertOpen(false)} className="flex-1 rounded-xl border px-4 py-3 font-semibold">Cancel</button><button disabled={saving} className="flex-1 rounded-xl bg-brand px-4 py-3 font-bold text-white">{saving ? "Saving…" : "Save alert"}</button></div>
        </form>
      </div>}
    </div>
  );
}
