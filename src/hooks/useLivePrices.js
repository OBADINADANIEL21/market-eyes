import { useEffect, useMemo, useState } from "react";
import { usdRates as fallbackRates } from "../data";
import { supabase, supabaseConfigError } from "../lib/supabase";

const RATE_URL = "https://open.er-api.com/v6/latest/USD";
const REFRESH_MS = 5 * 60_000;
const CACHE_KEY = "market-eye-price-cache";
const PAGE_SIZE = 20;

const fallbackCatalogUsdRates = {
  NGN: fallbackRates.NGN,
  KES: fallbackRates.KES,
  INR: fallbackRates.INR,
  PHP: fallbackRates.PHP,
  GHS: fallbackRates.GHS,
  ZAR: fallbackRates.ZAR,
  GBP: fallbackRates.GBP,
  CAD: fallbackRates.CAD,
  AUD: fallbackRates.AUD,
  BRL: fallbackRates.BRL,
  USD: 1,
};

function makeSupabasePrices(rows, rates, histories = []) {
  return rows.flatMap((row, index) => {
    const item = row.item ?? row.item_name ?? row.product;
    const city = row.city ?? row.location;
    const market = row.market ?? row.market_name;
    const country = row.country ?? "Nigeria";
    const currency = String(row.currency ?? row.currency_code ?? "NGN").toUpperCase();
    const price = Number(row.price ?? row.price_amount);

    if (
      country !== "Nigeria" ||
      typeof item !== "string" ||
      typeof city !== "string" ||
      typeof market !== "string" ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      return [];
    }

    const rate = rates[currency] ?? fallbackCatalogUsdRates[currency];
    const usdPrice = currency === "USD" ? price : Number.isFinite(rate) && rate > 0 ? price / rate : null;
    if (usdPrice === null) return [];

    const history = histories
      .filter((entry) => entry.price_id === row.id)
      .map((entry) => ({ price: Number(entry.price), date: entry.captured_at }))
      .filter((entry) => Number.isFinite(entry.price) && entry.price > 0)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    const firstHistoryPrice = history[0]?.price;
    const latestHistoryPrice = history[history.length - 1]?.price;
    const trend = firstHistoryPrice === undefined || latestHistoryPrice === undefined || firstHistoryPrice === latestHistoryPrice
      ? "stable"
      : latestHistoryPrice > firstHistoryPrice ? "up" : "down";
    const sellerProfile = row.sellerProfile;
    return [{
      id: String(row.id ?? `supabase-price-${index}`),
      item,
      country,
      city,
      market,
      unit: row.unit ?? row.pack_size ?? row.quantity ?? "",
      price,
      currency,
      trend,
      verifiedCount: Number(row.verified_count ?? row.report_count ?? 0),
      reportCount: Number(row.report_count ?? 0),
      sellerId: row.seller_id ?? null,
      storeName: sellerProfile?.store_name ?? null,
      sellerMarket: sellerProfile?.market ?? null,
      sellerVerified: Boolean(sellerProfile?.verified),
      whatsappNumber: sellerProfile?.whatsapp_number ?? null,
      showWhatsapp: sellerProfile?.show_whatsapp ?? false,
      groupLink: sellerProfile?.group_link ?? null,
      photoUrl: row.photo_url ?? null,
      verifiedToday: 0,
      usdPrice,
      priceSource: "supabase",
      createdAt: row.created_at ?? null,
      history: history.map((entry) => entry.price),
      historyDates: history.map((entry) => entry.date),
      historySource: history.length >= 2 ? "recorded" : null,
      live: false,
    }];
  });
}

async function fetchSupabasePrices(from = 0) {
  if (!supabase) return { rows: null, error: supabaseConfigError };
  if (!navigator.onLine) return { rows: null, error: null };

  const { data, error } = await supabase
    .from("prices")
    .select("id,item,country,city,market,unit,price,currency,created_at,seller_id,photo_url,report_count,verified_count")
    .eq("country", "Nigeria")
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (error) return { rows: null, error: error.message };
  const rows = data ?? [];
  if (!rows.length) return { rows, history: [], error: null };
  const { data: history, error: historyError } = await supabase
    .from("price_history")
    .select("price_id,price,captured_at")
    .in("price_id", rows.map((row) => row.id))
    .gte("captured_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order("captured_at", { ascending: true });
  if (historyError) console.warn("Price history is unavailable until the database migration is applied:", historyError);
  const sellerIds = [...new Set(rows.map((row) => row.seller_id).filter(Boolean))];
  let sellerProfiles = [];
  if (sellerIds.length) {
    const { data: profileRows, error: sellerProfileError } = await supabase
      .from("seller_public_profiles")
      .select("id,store_name,market,verified,show_whatsapp,whatsapp_number,group_link")
      .in("id", sellerIds);
    if (sellerProfileError) {
      console.warn("Seller contact details are unavailable:", sellerProfileError);
    } else sellerProfiles = profileRows ?? [];
  }
  const sellerProfileById = Object.fromEntries(sellerProfiles.map((profile) => [profile.id, profile]));
  const enrichedRows = rows.map((row) => ({
    ...row,
    sellerProfile: sellerProfileById[row.seller_id] ?? null,
  }));
  return { rows: enrichedRows, history: history ?? [], error: null };
}

function getCachedPrices() {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (!Array.isArray(cache?.rows)) return null;
    return cache;
  } catch {
    return null;
  }
}

async function fetchRates(signal) {
  const response = await fetch(RATE_URL, { signal });
  if (!response.ok) throw new Error(`Exchange-rate service returned ${response.status}`);
  const data = await response.json();
  if (data.result !== "success" || !data.rates) {
    throw new Error("Exchange-rate service returned an invalid response");
  }

  return {
    NGN: data.rates.NGN,
    KES: data.rates.KES,
    INR: data.rates.INR,
    PHP: data.rates.PHP,
    GHS: data.rates.GHS,
    ZAR: data.rates.ZAR,
    GBP: data.rates.GBP,
    CAD: data.rates.CAD,
    AUD: data.rates.AUD,
    BRL: data.rates.BRL,
    USD: 1,
  };
}

export function useLivePrices() {
  const cachedPrices = useMemo(() => getCachedPrices(), []);
  const [rates, setRates] = useState(cachedPrices?.rates ?? fallbackCatalogUsdRates);
  const [loading, setLoading] = useState(!cachedPrices?.rows?.length);
  const [lastUpdated, setLastUpdated] = useState(cachedPrices?.savedAt ?? null);
  const [now, setNow] = useState(Date.now());
  const [databaseRows, setDatabaseRows] = useState(cachedPrices?.rows ?? null);
  const [historyRows, setHistoryRows] = useState(cachedPrices?.history ?? []);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState((cachedPrices?.rows?.length ?? 0) === PAGE_SIZE);
  const [dataError, setDataError] = useState(supabaseConfigError);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 10_000);

      try {
        const [nextRates, priceResult] = await Promise.all([
          fetchRates(controller.signal).catch((error) => {
            if (error.name !== "AbortError") console.error("Could not refresh exchange rates:", error);
            return null;
          }),
          fetchSupabasePrices(0).catch((error) => {
            console.error("Could not load Supabase prices:", error);
            return { rows: null, error: error.message };
          }),
        ]);

        if (!active) return;
        if (nextRates && Object.values(nextRates).every(Number.isFinite)) {
          setRates(nextRates);
        }
        if (priceResult.rows?.length) {
          setDatabaseRows(priceResult.rows);
          setHistoryRows(priceResult.history ?? []);
          setHasMore(priceResult.rows.length === PAGE_SIZE);
          setDataError(null);
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
              rows: priceResult.rows,
              history: priceResult.history ?? [],
              rates: nextRates ?? rates,
              savedAt: Date.now(),
            }));
          } catch (error) {
            console.warn("Could not cache price listings:", error);
          }
        } else {
          if (priceResult.rows && priceResult.rows.length === 0) setDatabaseRows(null);
          setDataError(priceResult.error);
        }
      } catch (error) {
        if (error.name !== "AbortError") console.error("Could not refresh live prices:", error);
      } finally {
        window.clearTimeout(timeout);
        if (active) {
          setLastUpdated(Date.now());
          setLoading(false);
        }
      }
    };

    void refresh();
    const refreshTimer = window.setInterval(() => void refresh(), REFRESH_MS);
    const ageTimer = window.setInterval(() => setNow(Date.now()), 1_000);

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      window.clearInterval(ageTimer);
    };
  }, []);

  const loadMore = async () => {
    if (loadingMore || !hasMore || !supabase || !navigator.onLine) return;
    setLoadingMore(true);
    try {
      const result = await fetchSupabasePrices(databaseRows?.length ?? 0);
      if (result.error) throw new Error(result.error);
      const nextRows = [...(databaseRows ?? []), ...(result.rows ?? [])];
      const nextHistory = [...historyRows, ...(result.history ?? [])];
      setDatabaseRows(nextRows);
      setHistoryRows(nextHistory);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ rows: nextRows, history: nextHistory, rates, savedAt: Date.now() }));
      } catch (error) {
        console.warn("Could not cache additional price listings:", error);
      }
      setHasMore((result.rows?.length ?? 0) === PAGE_SIZE);
    } catch (error) {
      console.error("Could not load more price listings:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const supabasePrices = useMemo(
    () => databaseRows ? makeSupabasePrices(databaseRows, rates, historyRows) : [],
    [databaseRows, historyRows, rates]
  );
  const prices = supabasePrices;
  const dataSource = supabasePrices.length ? "supabase" : "empty";
  const visibleDataError =
    dataError ||
    (databaseRows?.length && !supabasePrices.length
      ? "The Supabase prices table has rows, but none match the expected price fields."
      : null);
  const trend = useMemo(
    () => Object.fromEntries(prices.map((entry) => [entry.id, entry.trend])),
    [prices]
  );

  return {
    prices,
    rates,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    lastUpdated,
    trend,
    now,
    historyRows,
    dataSource,
    dataError: visibleDataError,
  };
}
