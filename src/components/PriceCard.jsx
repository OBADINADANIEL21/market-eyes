import { useSettings } from "../context/SettingsContext";
import { currencySymbols, formatPrice, getItemEmoji } from "../data";
import PriceHistory from "./PriceHistory";
import TrendBadge from "./TrendBadge";

/**
 * One price entry. Used on Home (featured) and Search.
 * - isCheat:   price is >20% above the local average -> red alert styling
 * - showChart: show the 7-day bar chart (Search shows it, Home does not)
 * In Mama Mode only the item emoji + price are shown.
 */
export default function PriceCard({
  entry,
  isCheat = false,
  showChart = true,
  loading = false,
  rates,
}) {
  const { mama, t } = useSettings();
  const price = formatPrice(entry.price, entry.currency);
  const emoji = getItemEmoji(entry.item);
  const usdPrice = Number(entry.usdPrice ?? entry.price);
  const nairaPrice = usdPrice * (rates?.NGN ?? 1500);
  const priceStatus =
    entry.priceSource === "simulation"
      ? "SIMULATED · NOT A MARKET QUOTE"
      : entry.priceSource === "commodity-api"
        ? "COMMODITY BENCHMARK · NOT RETAIL"
        : entry.priceSource === "estimate"
          ? "ESTIMATE · NOT VERIFIED"
          : "SAMPLE ESTIMATE · NOT VERIFIED";
  const isVerified = entry.priceSource === "community-verified";
  const trendLabel = isVerified
    ? entry.trend === "up"
      ? "↑"
      : entry.trend === "down"
        ? "↓"
        : "—"
    : "";

  // ----- Mama Mode: emoji + price only -----
  if (mama) {
    return (
      <article
        className={`price-card bg-white rounded-3xl shadow-lg p-5 flex items-center justify-between gap-4 border-l-8 ${
          isCheat ? "border-red-500" : "border-brand"
        }`}
      >
        <span className="text-6xl leading-none" role="img" aria-label={entry.item}>
          {emoji}
        </span>
        <span className="text-right font-extrabold text-brand">
          {price}
          <span className="block text-xs font-semibold text-gray-500">
            ${usdPrice.toFixed(2)} · {currencySymbols.NGN}{" "}
            {nairaPrice.toLocaleString("en-NG", {
              maximumFractionDigits: 0,
            })}
          </span>
          <span className="block text-xs font-semibold text-gray-500">{priceStatus}</span>
          {isCheat && (
            <span className="block text-red-500" role="img" aria-label={t("card.cheat")}>
              ⚠️
            </span>
          )}
        </span>
      </article>
    );
  }

  // ----- Full card -----
  return (
    <article
      className={`price-card bg-white rounded-2xl shadow-lg p-5 border-t-4 ${
        isCheat ? "border-red-500" : "border-brand"
      }`}
    >
      {isCheat && (
        <div className="bg-red-500 text-white text-xs font-bold px-3 py-2 rounded-xl mb-3">
          {t("card.cheat")}
        </div>
      )}

      <div className="flex justify-between items-start gap-3 mb-2">
        <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
          <span aria-hidden="true">{emoji}</span>
          {entry.item}
        </h3>
        {isVerified && <TrendBadge trend={entry.trend} />}
      </div>

      <div className="text-2xl md:text-3xl font-extrabold text-brand">
        {entry.price.toLocaleString()} <span className="text-sm font-semibold">{entry.currency}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-600">
        <span>${usdPrice.toFixed(2)}</span>
        <span aria-hidden="true">·</span>
        <span>
          {currencySymbols.NGN}{" "}
          {nairaPrice.toLocaleString("en-NG", {
            maximumFractionDigits: 0,
          })}
        </span>
        {isVerified && (
          <span className={entry.trend === "down" ? "text-red-600" : "text-green-700"}>
            {trendLabel}
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
          {priceStatus}
        </span>
        {loading && <span className="text-xs text-gray-500">Loading exchange-rate data...</span>}
      </div>
      <div className="text-sm text-gray-500 mt-2">{entry.market}</div>
      <div className="text-sm text-gray-500">
        {entry.city}, {entry.country}
      </div>

      <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
        Not independently verified. Confirm the price with the market before relying on it.
      </div>
      {showChart && entry.historySource === "verified" && entry.history?.length >= 7 && (
        <PriceHistory history={entry.history} currency={entry.currency} />
      )}
    </article>
  );
}
