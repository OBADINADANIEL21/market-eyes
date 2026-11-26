import { Suspense, lazy, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { currencySymbols, formatPrice, getItemEmoji } from "../data";
import { normalizeHttpsUrl } from "../lib/whatsapp";
import { createPriceCardImage } from "../lib/priceCardImage";
import TrendBadge from "./TrendBadge";
import PriceDebate from "./PriceDebate";
import PriceCrowd from "./PriceCrowd";

const PriceHistory = lazy(() => import("./PriceHistory"));

function updatedLabel(createdAt) {
  const timestamp = new Date(createdAt ?? "").getTime();
  if (!Number.isFinite(timestamp)) return null;
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours} hr ago`;
  return `Updated ${Math.floor(hours / 24)} day${hours >= 48 ? "s" : ""} ago`;
}

function SellerHeader({ entry }) {
  if (!entry.storeName) return null;
  return (
    <div className="mb-3">
      <div className="font-bold text-gray-900">
        {entry.storeName}
        {entry.sellerVerified && <span className="ml-1 text-blue-600" aria-label="Verified seller">✓ Verified</span>}
      </div>
      <div className="text-sm text-gray-500">{entry.sellerMarket || entry.market}</div>
    </div>
  );
}

function SellerActions({ entry }) {
  if (!entry.sellerId || !entry.storeName) return null;
  const phoneDigits = entry.showWhatsapp ? entry.whatsappNumber?.replace(/\D/g, "") : "";
  const groupLink = normalizeHttpsUrl(entry.groupLink ?? "");
  const whatsappText = `Hello ${entry.storeName}, I saw ${entry.item} for ${currencySymbols[entry.currency] ?? ""}${entry.price.toLocaleString()} on Market Eye, e still correct?`;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {phoneDigits ? (
        <a href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(whatsappText)}`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-green-600 px-3 py-2 text-sm font-bold text-white">💬 WhatsApp Store</a>
      ) : <span className="text-sm font-semibold text-gray-500">WhatsApp Hidden</span>}
      {groupLink && <a href={groupLink} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-brand px-3 py-2 text-sm font-bold text-brand">👥 Group</a>}
    </div>
  );
}

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
  prices = [],
}) {
  const { mama, t } = useSettings();
  const { user } = useAuth();
  const [verifyMessage, setVerifyMessage] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [sharingCard, setSharingCard] = useState(false);
  const [cardMessage, setCardMessage] = useState("");
  const [quantity, setQuantity] = useState(1);
  const price = formatPrice(entry.price, entry.currency);
  const emoji = getItemEmoji(entry.item);
  const usdPrice = Number(entry.usdPrice ?? entry.price);
  const nairaPrice = usdPrice * (rates?.NGN ?? 1500);
  const priceStatus = "COMMUNITY LISTING · CONFIRM BEFORE BUYING";
  const hasTrend = entry.history?.length >= 2;
  const trendLabel = hasTrend
    ? entry.trend === "up"
      ? "↑"
      : entry.trend === "down"
        ? "↓"
        : "—"
    : "";

  const sharePriceCard = async () => {
    setSharingCard(true);
    setCardMessage("");
    try {
      const blob = await createPriceCardImage(entry);
      const file = new File([blob], "market-eye-price.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: `${entry.item} price`, text: `${entry.item} at ${entry.market} · ${price}` });
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "market-eye-price.png";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      const whatsappText = `Market Eye price: ${entry.item} at ${entry.market} — ${price}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(whatsappText)}`, "_blank", "noopener,noreferrer");
      setCardMessage("Image downloaded. Attach it to the WhatsApp message.");
    } catch (error) {
      console.error("Could not share price card:", error);
      setCardMessage("Could not create the image. Please try again.");
    } finally {
      setSharingCard(false);
    }
  };

  const downloadPriceCard = async () => {
    setSharingCard(true);
    setCardMessage("");
    try {
      const blob = await createPriceCardImage(entry);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "market-eye-price.png";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("Could not download price card:", error);
      setCardMessage("Could not create the image. Please try again.");
    } finally {
      setSharingCard(false);
    }
  };

  // ----- Mama Mode: emoji + price only -----
  if (mama) {
    return (
      <article
        className={`price-card bg-white rounded-3xl shadow-lg p-5 border-l-8 ${
          isCheat ? "border-red-500" : "border-brand"
        }`}
      >
        <SellerHeader entry={entry} />
        <div className="flex items-center justify-between gap-4">
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
        </div>
        <SellerActions entry={entry} />
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
      <SellerHeader entry={entry} />
      {isCheat && (
        <div className="bg-red-500 text-white text-xs font-bold px-3 py-2 rounded-xl mb-3">
          {t("card.cheat")}
        </div>
      )}

      <div className="flex justify-between items-start gap-3 mb-2">
        <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
          <span aria-hidden="true">{emoji}</span>
          {entry.item}{entry.unit && <span className="text-sm font-medium text-gray-500">· {entry.unit}</span>}
        </h3>
        {hasTrend && <TrendBadge trend={entry.trend} />}
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
        {hasTrend && (
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
      {updatedLabel(entry.createdAt) && <div className="mt-1 text-xs text-gray-500">{updatedLabel(entry.createdAt)}</div>}
      {entry.priceSource === "supabase" && <div className="mt-1 text-xs font-semibold text-gray-600">Confirm count: {entry.verifiedCount}</div>}

      <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
        Not independently verified. Confirm the price with the market before relying on it.
      </div>
      {showChart && entry.historySource === "recorded" && entry.history?.length >= 2 && (
        <Suspense fallback={<div className="mt-4 h-40 animate-pulse rounded-xl bg-gray-100" />}>
          <PriceHistory history={entry.history} historyDates={entry.historyDates} currency={entry.currency} />
        </Suspense>
      )}
      {entry.photoUrl && <a href={entry.photoUrl} target="_blank" rel="noreferrer" className="mt-3 block"><img src={entry.photoUrl} alt={`Price proof for ${entry.item}`} loading="lazy" width="200" height="150" className="h-32 w-full rounded-xl object-cover" /><span className="text-xs text-brand underline">Open photo proof</span></a>}
      {entry.priceSource === "supabase" && entry.reportCount > 0 && <p className="mt-2 text-xs font-semibold text-gray-600">Trust score: {Math.min(100, Math.round((entry.verifiedCount / entry.reportCount) * 100))}% · {entry.reportCount} approved report{entry.reportCount === 1 ? "" : "s"}</p>}
      {entry.priceSource === "supabase" && showChart && <>
        <PriceCrowd priceId={entry.id} enabled={Boolean(user)} />
        <PriceDebate entry={entry} prices={prices} />
      </>}
      {entry.priceSource === "supabase" && <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={sharingCard} onClick={() => void downloadPriceCard()} className="rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-50">{sharingCard ? "Preparing…" : "Download price card"}</button>
        <button type="button" disabled={sharingCard} onClick={() => void sharePriceCard()} className="rounded-lg bg-green-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Share price card</button>
      </div>}
      {cardMessage && <p role="status" className="mt-2 text-xs text-gray-600">{cardMessage}</p>}
      {entry.priceSource === "supabase" && showChart && <div className="mt-4 rounded-xl bg-gray-50 p-3">
        <label className="flex items-center gap-3 text-sm font-semibold">Quantity ({entry.unit || "units"})
          <div className="ml-auto flex items-center gap-2">
            <button type="button" aria-label="Decrease quantity" onClick={() => setQuantity((current) => Math.max(1, current - 1))} className="h-9 w-9 rounded-lg border bg-white text-lg">−</button>
            <input type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.floor(Number(event.target.value) || 1)))} className="w-16 rounded-lg border px-2 py-2 text-center" aria-label="Quantity" />
            <button type="button" aria-label="Increase quantity" onClick={() => setQuantity((current) => current + 1)} className="h-9 w-9 rounded-lg border bg-white text-lg">+</button>
          </div>
        </label>
        <p className="mt-2 text-sm">Estimated total: <strong>{formatPrice(entry.price * quantity, entry.currency)}</strong></p>
      </div>}
      <SellerActions entry={entry} />
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
