import { useSettings } from "../context/SettingsContext";
import { formatPrice } from "../data";
const medals = ["🥇", "🥈", "🥉"];

/** Shows the three most recently updated database price listings. */
export default function Leaderboard({ prices = [], dataSource }) {
  const { t, lang } = useSettings();
  const top = dataSource === "supabase"
    ? [...prices]
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 3)
    : [];

  return (
    <section className="max-w-3xl mx-auto px-4 py-14">
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900">
          🏆 {lang === "pn" ? "Latest Price Listings" : "Latest Price Listings"}
        </h2>
        <p className="text-gray-500 mt-1">
          {top.length
            ? lang === "pn"
              ? "Latest price listings"
              : "Most recently added price listings"
            : lang === "pn"
              ? "No price dey available now"
              : "No price listings are available right now"}
        </p>
      </div>

      {top.length > 0 && <ol className="bg-white rounded-3xl shadow-lg divide-y divide-gray-100 overflow-hidden">
        {top.map((entry, i) => (
          <li key={entry.id} className="px-5 py-4 hover:bg-emerald-50/60 transition-colors">
            <div className="flex items-center gap-3">
              <span className="w-9 text-center text-2xl shrink-0" aria-label={`#${i + 1}`}>
                {medals[i] ?? <span className="text-base font-bold text-gray-400">{i + 1}</span>}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-gray-900 truncate">{entry.item}{entry.unit ? ` · ${entry.unit}` : ""}</div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-gray-500 truncate">
                    {entry.market} · {entry.city}, {entry.country}
                  </span>
                  <span className="text-sm font-extrabold text-brand whitespace-nowrap">
                    {formatPrice(entry.price, entry.currency)}
                  </span>
                </div>
                {entry.createdAt && (
                  <div className="mt-1 text-xs text-gray-400">
                    {new Date(entry.createdAt).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>}
    </section>
  );
}
