import { useMemo, useState } from "react";
import { formatPrice } from "../data";
import { useSettings } from "../context/SettingsContext";

const medals = ["🥇", "🥈", "🥉"];
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Ranks real listings from the last week; demo estimates are never presented as winners. */
export default function Leaderboard({ prices = [], dataSource }) {
  const { lang } = useSettings();
  const recent = dataSource === "supabase"
    ? prices.filter((entry) => entry.createdAt && Date.now() - new Date(entry.createdAt).getTime() <= WEEK_MS)
    : [];
  const items = useMemo(() => [...new Set(recent.map((entry) => entry.item))], [recent]);
  const [selectedItem, setSelectedItem] = useState("");
  const currentItem = items.includes(selectedItem) ? selectedItem : items[0] ?? "";
  const top = [...recent]
    .filter((entry) => entry.item === currentItem && Number.isFinite(entry.usdPrice))
    .sort((a, b) => a.usdPrice - b.usdPrice)
    .slice(0, 3);

  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-extrabold text-gray-900 md:text-3xl">🏆 {lang === "pn" ? "Na Here This Item Cheap Pass This Week" : "Cheapest Markets This Week"}</h2>
        <p className="mt-1 text-gray-500">Top three approved market listings added in the last seven days. Estimates are excluded.</p>
        {items.length > 0 && <label className="mx-auto mt-4 block max-w-sm text-left text-sm font-semibold">Choose item
          <select value={currentItem} onChange={(event) => setSelectedItem(event.target.value)} className="mt-1 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3">
            {items.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>}
      </div>
      {top.length > 0 ? <ol className="divide-y overflow-hidden rounded-3xl bg-white shadow-lg">{top.map((entry, index) => <li key={entry.id} className="flex items-center gap-3 px-5 py-4">
        <span className="w-9 text-center text-2xl">{medals[index]}</span>
        <div className="min-w-0 flex-1"><div className="truncate font-bold">{entry.market}</div><div className="truncate text-sm text-gray-500">{entry.city}, {entry.country}</div></div>
        <div className="text-right"><div className="font-extrabold text-brand">{formatPrice(entry.price, entry.currency)}</div><div className="text-xs text-gray-500">{new Date(entry.createdAt).toLocaleDateString()}</div></div>
      </li>)}</ol> : <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-5 text-center text-gray-500">No approved listings for the last seven days yet.</p>}
    </section>
  );
}
