import { useEffect, useMemo, useState } from "react";
import { formatPrice } from "../data";
import { useLivePrices } from "../hooks/useLivePrices";

function getDailyChanges(prices, historyRows, now) {
  const cutoff = now - 24 * 60 * 60 * 1000;
  return prices.flatMap((entry) => {
    if (entry.priceSource !== "supabase") return [];
    const points = historyRows
      .filter((point) => String(point.price_id) === String(entry.id))
      .map((point) => ({ price: Number(point.price), time: new Date(point.captured_at).getTime() }))
      .filter((point) => Number.isFinite(point.price) && point.price > 0 && Number.isFinite(point.time))
      .sort((a, b) => a.time - b.time);
    const baseline = points.filter((point) => point.time <= cutoff).at(-1);
    const latestHistory = points.filter((point) => point.time > cutoff).at(-1);
    const createdAt = new Date(entry.createdAt ?? "").getTime();
    const latest = latestHistory ?? (
      Number.isFinite(createdAt) && createdAt > cutoff
        ? { price: entry.price, time: createdAt }
        : null
    );
    if (!baseline || !latest || baseline.price === 0 || latest.price === baseline.price) return [];
    const percent = ((latest.price - baseline.price) / baseline.price) * 100;
    return [{ ...entry, previousPrice: baseline.price, currentPrice: latest.price, percent }];
  }).sort((a, b) => Math.abs(b.percent) - Math.abs(a.percent)).slice(0, 5);
}

export default function PriceBrief({ goTo }) {
  const { prices, historyRows, loading, loadingMore, hasMore, loadMore, dataSource } = useLivePrices();
  const [now, setNow] = useState(Date.now());
  const [audioMessage, setAudioMessage] = useState("");
  const changes = useMemo(() => getDailyChanges(prices, historyRows, now), [prices, historyRows, now]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const summary = changes.length
    ? `MARKET EYE daily price brief. ${changes.map((entry) => `${entry.item} at ${entry.market} ${entry.percent < 0 ? "fell" : "rose"} ${Math.abs(entry.percent).toFixed(1)} percent to ${formatPrice(entry.currentPrice, entry.currency)}.`).join(" ")}`
    : "";

  const playRadio = () => {
    if (!summary || !("speechSynthesis" in window)) {
      setAudioMessage(summary ? "Audio playback is not supported in this browser." : "There are no verified price changes to read out.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(summary);
    utterance.lang = "en-NG";
    utterance.onend = () => setAudioMessage("");
    utterance.onerror = () => setAudioMessage("Audio playback could not start.");
    setAudioMessage("Playing the price brief…");
    window.speechSynthesis.speak(utterance);
  };

  const shareBrief = () => {
    if (!summary) return;
    const url = `https://wa.me/?text=${encodeURIComponent(summary)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return <main className="mx-auto max-w-4xl px-4 py-8">
    <button type="button" onClick={() => goTo("home")} className="mb-4 text-sm font-bold text-brand">← Home</button>
    <h1 className="text-3xl font-extrabold">Daily price brief</h1>
    <p className="mt-2 text-gray-600">The biggest verified price changes recorded in the last 24 hours.</p>
    {dataSource !== "supabase" && !loading && <p role="status" className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">The brief uses approved database listings only. No sample estimates are used.</p>}
    <p className="mt-2 text-sm text-gray-500">To receive the 7am push, enable it in Profile &amp; Settings and allow browser notifications. Scheduled delivery also requires the production notification environment settings.</p>
    {loading && <p role="status" className="mt-5 text-gray-600">Loading price history…</p>}
    {changes.length > 0 && <>
      <div className="my-5 flex flex-wrap gap-2">
        <button type="button" onClick={playRadio} className="rounded-xl bg-brand px-4 py-3 font-bold text-white">▶ Play audio</button>
        <button type="button" onClick={shareBrief} className="rounded-xl border px-4 py-3 font-bold">Forward brief to WhatsApp</button>
      </div>
      {audioMessage && <p role="status" className="mb-4 text-sm text-gray-600">{audioMessage}</p>}
      <ol className="space-y-3">{changes.map((entry) => {
        const changeColor = entry.percent < 0 ? "text-emerald-800" : "text-red-700";
        return <li key={entry.id} className="rounded-2xl bg-white p-5 shadow">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h2 className="font-bold">{entry.item}</h2><p className="text-sm text-gray-500">{entry.market} · {entry.city}</p></div>
            <strong className={changeColor}>{entry.percent > 0 ? "+" : ""}{entry.percent.toFixed(1)}%</strong>
          </div>
          <p className="mt-3 text-sm text-gray-700">{formatPrice(entry.previousPrice, entry.currency)} → <strong>{formatPrice(entry.currentPrice, entry.currency)}</strong></p>
        </li>;
      })}</ol>
    </>}
    {!loading && !changes.length && <div className="mt-5 rounded-2xl bg-white p-6 text-gray-600 shadow">No verified price changes are available for the last 24 hours yet.</div>}
    {hasMore && <button type="button" disabled={loadingMore} onClick={() => void loadMore()} className="mt-5 rounded-xl border px-4 py-3 font-bold">{loadingMore ? "Loading…" : "Load more listings"}</button>}
  </main>;
}
