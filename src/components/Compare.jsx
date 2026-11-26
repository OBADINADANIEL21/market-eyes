import { useMemo, useState } from "react";
import { cityFlags, currencySymbols, formatPrice, getItemEmoji } from "../data";
import { useSettings } from "../context/SettingsContext";
import { useLivePrices } from "../hooks/useLivePrices";
import TrendBadge from "./TrendBadge";
import EmptyState from "./EmptyState";

// Full class names (no string-building) so Tailwind can detect them
const tones = {
  cheapest: { border: "border-emerald-500", bar: "bg-emerald-500", badge: "bg-emerald-500 text-white" },
  priciest: { border: "border-red-500", bar: "bg-red-500", badge: "bg-red-500 text-white" },
  middle: { border: "border-gray-200", bar: "bg-amber-400", badge: "bg-amber-100 text-amber-800" },
};

export default function Compare({ goTo }) {
  const { t, mama } = useSettings();
  const { prices, rates, loading, dataSource, dataError } = useLivePrices();
  const compareCities = useMemo(() => [...new Set(prices.map((p) => p.city))], [prices]);
  const items = useMemo(() => [...new Set(prices.map((p) => p.item))], [prices]);
  const [selectedItem, setSelectedItem] = useState(items[0]);

  // One row per city for the chosen item, ranked by USD price (cheapest first).
  // Ranking uses USD so currencies are compared fairly.
  const rows = useMemo(() => {
    const list = compareCities
      .map((city) => {
        const entry = prices.find((p) => p.item === selectedItem && p.city === city);
        return entry ? { city, entry, usd: entry.usdPrice ?? entry.price } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.usd - b.usd);

    const cheapest = list[0]?.usd ?? 0;
    const priciest = list[list.length - 1]?.usd ?? 0;
    return { list, cheapest, priciest };
  }, [compareCities, prices, selectedItem]);

  const { list, cheapest, priciest } = rows;
  const gap = cheapest ? Math.round(((priciest - cheapest) / cheapest) * 100) : 0;

  const rateNote = `${currencySymbols.NGN} ${(rates.NGN ?? 1500).toLocaleString("en-US")}`;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-2">{t("compare.title")}</h1>
      {!mama && <p className="text-gray-500 mb-8">{t("compare.subtitle")}</p>}
      <button type="button" onClick={() => goTo?.("bulk")} className="mb-6 rounded-xl border border-brand px-4 py-2 font-bold text-brand">Bulk compare &amp; budget</button>
      {dataSource !== "supabase" && !loading && (
        <div role="status" className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {dataError ? "Price listings could not be loaded. Check your connection and try again." : "No verified market prices are available yet. Estimates are not shown."}
        </div>
      )}

      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">{t("compare.choose")}</label>
        <select
          value={selectedItem}
          onChange={(e) => setSelectedItem(e.target.value)}
          className="border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-brand focus:outline-none font-medium max-w-xs w-full bg-white"
        >
          {items.map((item) => (
            <option key={item} value={item}>
              {getItemEmoji(item)} {item}
            </option>
          ))}
        </select>
      </div>

      {list.length === 0 ? (
        <EmptyState icon="⚖️" title={t("compare.emptyTitle")} message={t("compare.emptyBody")} />
      ) : (
        <>
          {/* Summary strip */}
          {!mama && (
            <div className="bg-brand-soft border-2 border-emerald-200 text-emerald-900 rounded-2xl px-5 py-4 mb-6 font-semibold text-sm md:text-base">
              💡{" "}
              {t("compare.summary", {
                cheap: list[0].city,
                pricey: list[list.length - 1].city,
                n: gap,
              })}
            </div>
          )}

          <ul className="space-y-4">
            {list.map(({ city, entry, usd }, i) => {
              const rank = i === 0 ? "cheapest" : i === list.length - 1 ? "priciest" : "middle";
              const tone = tones[rank];
              const above = cheapest ? Math.round(((usd - cheapest) / cheapest) * 100) : 0;
              const width = priciest ? Math.max(6, (usd / priciest) * 100) : 0;

              return (
                <li
                  key={`${selectedItem}-${city}`}
                  className={`price-card card-enter bg-white rounded-2xl shadow-lg p-5 border-l-8 ${tone.border}`}
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-extrabold text-lg text-gray-900">
                        <span aria-hidden="true">{cityFlags[city] ?? "🇳🇬"}</span> {city}
                      </h3>
                      {!mama && (
                        <p className="text-sm text-gray-500">
                          {entry.country} · {entry.market}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${tone.badge}`}>
                        {rank === "cheapest"
                          ? `✅ ${t("compare.cheapest")}`
                          : rank === "priciest"
                            ? `🔺 ${t("compare.priciest")}`
                            : t("compare.above", { n: above })}
                      </span>
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900">
                        Community listing · verify before purchase
                      </span>
                      {loading && <span className="text-xs text-gray-500">Loading exchange-rate data...</span>}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4 items-end">
                    <div>
                      {!mama && <div className="text-xs text-gray-400 font-semibold">{t("compare.local")}</div>}
                      <div className="text-xl font-extrabold text-brand">
                        {formatPrice(entry.price, entry.currency)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 font-semibold">{t("compare.usd")}</div>
                      <div className="text-xl font-bold text-gray-800">
                        ${usd.toFixed(2)} · ₦{" "}
                        {(usd * (rates.NGN ?? 1500)).toLocaleString("en-NG", {
                          maximumFractionDigits: 0,
                        })}
                      </div>
                    </div>
                    {!mama && entry.history?.length >= 2 && (
                      <div className="col-span-2 md:col-span-1">
                        <div className="text-xs text-gray-400 font-semibold mb-1">{t("compare.trend")}</div>
                        <TrendBadge trend={entry.trend} />
                      </div>
                    )}
                  </div>

                  {/* Relative USD price bar */}
                  <div className="mt-4 h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`bar-fill h-full rounded-full ${tone.bar}`}
                      style={{ width: `${width}%`, animationDelay: `${i * 70 + 150}ms` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {!mama && (
        <p className="text-xs text-gray-400 mt-4">
          {t("compare.rates")} 1 USD = {rateNote}
        </p>
      )}
    </div>
  );
}
