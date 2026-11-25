import { Suspense, lazy, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { currencySymbols, formatPrice, getItemEmoji } from "../data";
import TrendBadge from "./TrendBadge";

const PriceHistory = lazy(() => import("./PriceHistory"));

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
  goTo,
}) {
  const { mama, t } = useSettings();
  const { user } = useAuth();
  const [verifyMessage, setVerifyMessage] = useState("");
  const [verifying, setVerifying] = useState(false);
  const price = formatPrice(entry.price, entry.currency);
  const emoji = getItemEmoji(entry.item);
  const usdPrice = Number(entry.usdPrice ?? entry.price);
  const nairaPrice = usdPrice * (rates?.NGN ?? 1500);
  const priceStatus =
    entry.priceSource === "simulation"
      ? "SIMULATED · NOT A MARKET QUOTE"
      : entry.priceSource === "commodity-api"
        ? "COMMODITY BENCHMARK · NOT RETAIL"
        : entry.priceSource === "supabase"
          ? "SUPABASE LISTING · VERIFY BEFORE BUYING"
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
      {showChart && entry.historySource === "verified" && entry.history?.length >= 2 && (
        <Suspense fallback={<div className="mt-4 h-40 animate-pulse rounded-xl bg-gray-100" />}>
          <PriceHistory history={entry.history} historyDates={entry.historyDates} currency={entry.currency} />
        </Suspense>
      )}
      {entry.photoUrl && <a href={entry.photoUrl} target="_blank" rel="noreferrer" className="mt-3 block"><img src={entry.photoUrl} alt={`Price proof for ${entry.item}`} loading="lazy" width="200" height="150" className="h-32 w-full rounded-xl object-cover" /><span className="text-xs text-brand underline">Open photo proof</span></a>}
      {entry.priceSource === "supabase" && entry.reportCount > 0 && <p className="mt-2 text-xs font-semibold text-gray-600">Trust score: {Math.min(100, Math.round((entry.verifiedCount / entry.reportCount) * 100))}% · {entry.reportCount} approved report{entry.reportCount === 1 ? "" : "s"}</p>}
      {user && entry.sellerId && entry.sellerId !== user.id && entry.priceSource === "supabase" && <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={verifying} onClick={async () => {
          setVerifying(true);
          setVerifyMessage("");
          const { error } = await supabase.rpc("verify_price", { p_price_id: entry.id });
          if (error) {
            console.error("Could not verify price:", error);
            setVerifyMessage("Could not verify. You may have already verified this listing.");
          } else setVerifyMessage("Thanks — your verification was recorded.");
          setVerifying(false);
        }} className="rounded-lg border border-brand px-3 py-2 text-sm font-bold text-brand">{verifying ? "Saving…" : "Verify price"}</button>
        {goTo && <button onClick={async () => {
          const { data, error } = await supabase.rpc("get_or_create_conversation", { p_other_user: entry.sellerId });
          if (error) {
            console.error("Could not start seller chat:", error);
            setVerifyMessage("Could not open seller chat. Please try again.");
          } else goTo("chat", { chatId: data });
        }} className="rounded-lg bg-brand px-3 py-2 text-sm font-bold text-white">Message seller</button>}
        {verifyMessage && <span role="status" className="self-center text-xs text-gray-600">{verifyMessage}</span>}
      </div>}
    </article>
  );
}
