import { useEffect, useMemo, useRef, useState } from "react";
import { itemEmoji } from "../data";
import { useSettings } from "../context/SettingsContext";
import { useLivePrices } from "../hooks/useLivePrices";
import PriceCard from "./PriceCard";
import EmptyState from "./EmptyState";

const selectCls =
  "w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-brand focus:outline-none font-medium bg-white";

export default function Search({ goTo }) {
  const { t, mama, lang } = useSettings();
  const { prices, rates, loading, loadingMore, hasMore, loadMore, lastUpdated, now, dataSource, dataError } = useLivePrices();
  const [city, setCity] = useState("");
  const [query, setQuery] = useState("");
  const [listingMode, setListingMode] = useState("all");
  const [marketFilter, setMarketFilter] = useState("");
  const [voiceStatus, setVoiceStatus] = useState("");
  const recognitionRef = useRef(null);

  useEffect(() => {
    return () => recognitionRef.current?.abort();
  }, []);

  const cities = useMemo(() => [...new Set(prices.map((p) => p.city))], [prices]);

  const startVoiceSearch = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceStatus(lang === "pn" ? "Voice search no dey for this browser" : "Voice search is not supported in this browser");
      return;
    }

    if (recognitionRef.current) recognitionRef.current.abort();

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = lang === "yo" ? "yo-NG" : "en-NG";
    recognition.interimResults = false;
    recognition.continuous = false;

    setVoiceStatus(lang === "pn" ? "Dey listen..." : "Listening...");
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      const normalized = transcript.toLowerCase();
      const itemMatch = prices.find((price) => normalized.includes(price.item.split(" (")[0].toLowerCase()));
      const marketMatch = prices.find((price) =>
        normalized.includes(price.market.toLowerCase()) ||
        normalized.includes(price.market.replace(/\s+market$/i, "").toLowerCase())
      );
      const itemQuery = itemMatch?.item.split(" (")[0] ?? transcript;
      setQuery(itemQuery);
      if (marketMatch) {
        setListingMode("market");
        setMarketFilter(marketMatch.market);
      }
      const matchedPrice = prices.find((price) =>
        price.item.toLowerCase().includes(itemQuery.toLowerCase()) &&
        (!marketMatch || price.market === marketMatch.market)
      );
      const answer = matchedPrice
        ? `${matchedPrice.item} at ${matchedPrice.market} is ${matchedPrice.price.toLocaleString()} ${matchedPrice.currency}. This is a listing; please confirm it at the market.`
        : `We do not have a listing for ${itemQuery}${marketMatch ? ` in ${marketMatch.market}` : ""} yet.`;
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const speech = new SpeechSynthesisUtterance(
          lang === "pn" ? answer.replace("is ", "na ").replace("We do not have", "We no get") : answer
        );
        speech.lang = lang === "yo" ? "yo-NG" : "en-NG";
        window.speechSynthesis.speak(speech);
      }
      setVoiceStatus(lang === "pn" ? `We hear: ${transcript}` : lang === "yo" ? `A gbọ́: ${transcript}` : `Heard: ${transcript}`);
    };
    recognition.onerror = (event) => {
      const message =
        event.error === "not-allowed"
          ? lang === "pn"
            ? "Allow microphone make voice search work"
            : "Allow microphone access to use voice search"
          : lang === "pn"
            ? "We no hear wetin you say"
            : "Could not hear your search";
      setVoiceStatus(message);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
    };
    recognition.start();
  };

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return prices.filter((p) => {
      const matchCity = !city || p.city === city;
      const matchQuery = !q || p.item.toLowerCase().includes(q) || p.market.toLowerCase().includes(q);
      const matchMarket = listingMode !== "market" || !marketFilter || p.market === marketFilter;
      return matchCity && matchQuery && matchMarket;
    });
  }, [city, query, listingMode, marketFilter, prices]);

  // Average per item+city — a price >20% above it gets a cheat alert
  const averages = useMemo(() => {
    const groups = {};
    prices.forEach((p) => {
      const key = `${p.item}__${p.city}`;
      (groups[key] ||= []).push(p.price);
    });
    const avg = {};
    Object.entries(groups).forEach(([key, vals]) => {
      avg[key] = vals.reduce((a, b) => a + b, 0) / vals.length;
    });
    return avg;
  }, [prices]);

  const hasFilters = Boolean(city || query || marketFilter);
  const clearFilters = () => {
    setCity("");
    setQuery("");
    setMarketFilter("");
    setListingMode("all");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-2">{t("search.title")}</h1>
      {!mama && <p className="text-gray-500 mb-8">{t("search.subtitle")}</p>}
      {dataSource !== "supabase" && (
        <div role="status" className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {t("prices.fallback")}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex gap-2" role="tablist" aria-label="Price search mode">
        {[["all", "All Items"], ["market", "By Market"]].map(([value, label]) => <button key={value} role="tab" aria-selected={listingMode === value} onClick={() => setListingMode(value)} className={`rounded-full px-4 py-2 font-semibold ${listingMode === value ? "bg-brand text-white" : "bg-white text-gray-700"}`}>{label}</button>)}
      </div>
      <div className="bg-white rounded-2xl shadow-lg p-5 mb-6 grid md:grid-cols-3 gap-4">
        {listingMode === "market" && <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Market</label>
          <select value={marketFilter} onChange={(event) => setMarketFilter(event.target.value)} className={selectCls}>
            <option value="">All markets</option>{[...new Set(prices.map((price) => price.market))].map((name) => <option key={name}>{name}</option>)}
          </select>
        </div>}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">{t("search.country")}</label>
          <div className={`${selectCls} text-gray-700`}>🇳🇬 {t("search.nigeria")}</div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">{t("search.city")}</label>
          <select value={city} onChange={(e) => setCity(e.target.value)} className={selectCls}>
            <option value="">{t("search.allCities")}</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">{t("search.item")}</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search.placeholder")}
              className={selectCls}
              aria-label={lang === "pn" ? "Search item with your voice" : "Search item"}
            />
            <button
              type="button"
              onClick={startVoiceSearch}
              className="shrink-0 w-12 md:w-auto md:px-4 rounded-xl border-2 border-brand bg-brand-soft text-brand text-xl font-bold hover:bg-brand hover:text-white transition-colors"
              aria-label={lang === "pn" ? "Talk make we search" : "Search with voice"}
              title={lang === "pn" ? "Talk make we search" : "Voice search"}
            >
              🎤
            </button>
          </div>
          {voiceStatus && (
            <p className="mt-2 text-xs font-semibold text-gray-500" role="status" aria-live="polite">
              {voiceStatus}
            </p>
          )}
        </div>
      </div>

      {/* Quick-pick emoji chips (great for Mama Mode) */}
      <div className="flex flex-wrap items-center gap-2 mb-6" role="group" aria-label={t("search.quick")}>
        {Object.entries(itemEmoji).map(([name, emoji]) => {
          const active = query.toLowerCase() === name.toLowerCase();
          return (
            <button
              key={name}
              onClick={() => setQuery(active ? "" : name)}
              aria-pressed={active}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-semibold text-sm border-2 transition-all duration-200 hover:scale-105 ${
                active
                  ? "bg-brand text-white border-brand shadow"
                  : "bg-white text-gray-700 border-gray-200 hover:border-brand"
              }`}
            >
              <span aria-hidden="true">{emoji}</span>
              {!mama && name}
              {mama && <span className="sr-only">{name}</span>}
            </button>
          );
        })}
      </div>

      {/* Results */}
      <div className="text-sm text-gray-500 mb-4" aria-live="polite">
        {t(filtered.length === 1 ? "search.foundOne" : "search.foundMany", { n: filtered.length })}
      </div>

      {filtered.length === 0 && loading ? <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-52 animate-pulse rounded-2xl bg-gray-200" />)}</div> : <div className={`grid gap-5 ${mama ? "grid-cols-1 md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3"}`}>
        {filtered.map((p, i) => {
          const avg = averages[`${p.item}__${p.city}`];
          const isCheat =
            p.priceSource === "supabase" && Boolean(avg) && p.price > avg * 1.2;
          return (
            <div key={p.id} className="card-enter" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
              <PriceCard
                entry={p}
                isCheat={isCheat}
                loading={loading}
                lastUpdated={lastUpdated}
                now={now}
                rates={rates}
                goTo={goTo}
              />
            </div>
          );
        })}
      </div>}
      {dataSource === "supabase" && hasMore && <button disabled={loadingMore} onClick={() => void loadMore()} className="mt-5 rounded-xl border px-5 py-3 font-bold">{loadingMore ? "Loading…" : "Load more prices"}</button>}

      {filtered.length === 0 && (
        <>
          <EmptyState
            icon="🔍"
            title={t("search.emptyTitle")}
            message={mama ? undefined : t("search.emptyBody")}
            actionLabel={hasFilters ? t("search.clear") : undefined}
            onAction={clearFilters}
          />
          {/\b(beans|plantain)\b/i.test(query) && (
            <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
              <p className="font-semibold">
                {lang === "pn"
                  ? "We never get price wey we fit verify for Lagos yet. We no go guess am."
                  : "We don't have a verified Lagos price for this item yet, and won't invent one."}
              </p>
              <p className="mt-1 text-sm">
                {lang === "pn"
                  ? "Price reports dey save for this device only; dem no be verified community prices."
                  : "Price reports are currently saved on this device only; they are not independently verified or shared with other users."}
              </p>
              <button
                type="button"
                onClick={() => goTo?.("report")}
                className="mt-3 rounded-xl bg-brand px-4 py-2 font-bold text-white"
              >
                {lang === "pn" ? "Report price" : "Submit a price report"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
