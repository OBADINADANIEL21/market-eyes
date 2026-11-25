import { useEffect, useMemo, useState } from "react";
import { prices as catalogPrices, usdRates as fallbackRates } from "../data";
import { supabase, supabaseConfigError } from "../lib/supabase";

const RATE_URL = "https://open.er-api.com/v6/latest/USD";
const COMMODITY_URL = "https://commodities-api.com/api/latest";
const REFRESH_MS = 5 * 60_000;
const SIMULATION_MS = 15_000;
const CACHE_KEY = "market-eye-price-cache";
const PAGE_SIZE = 20;

const fallbackCommodityPrices = {
  Rice: 0.85,
  Wheat: 0.32,
  Maize: 0.25,
  Tomatoes: 1.2,
  Garri: 0.6,
};

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

const marketBases = {
  "Rice (50kg)": 85_000,
  "Tomatoes (1kg)": 5_000,
  "Garri (1kg)": 3_500,
};

const lagosMarkets = ["Mile 12 Market", "Oshodi", "Ibafo", "Arepo", "Magboro"];
const liveFallbackItems = new Set(["Rice", "Tomatoes", "Garri", "Wheat", "Maize"]);

function getCommodityName(item) {
  const name = item.split(" (")[0];
  if (name === "Corn") return "Maize";
  return name;
}

function makeLagosPrices(simulation, rates) {
  return Object.entries(marketBases).flatMap(([item, basePrice], itemIndex) =>
    lagosMarkets.map((market, marketIndex) => {
      const { change = 0, trend = "stable" } = simulation[`${item}-${market}`] ?? {};
      const variation = change;
      const price = Math.round(basePrice * (1 + variation));
      const history = Array.from({ length: 7 }, (_, index) => {
        if (index === 6) return price;
        const drift = (index - 3) * 0.004;
        return Math.round(price / (1 + drift + variation * 0.35));
      });

      return {
        id: `live-lagos-${itemIndex}-${marketIndex}`,
        item,
        country: "Nigeria",
        city: "Lagos",
        market,
        price,
        currency: "NGN",
        trend,
        verifiedCount: 0,
        verifiedToday: 0,
        usdPrice: price / (rates.NGN ?? fallbackCatalogUsdRates.NGN),
        priceSource: "simulation",
        live: true,
        history,
      };
    })
  );
}

function getApiUsdPrice(item, commodityRates) {
  const commodity = getCommodityName(item);
  const quote = commodityRates[commodity];
  return Number.isFinite(quote) && quote > 0 ? quote : null;
}

function makePrices(rates, commodityRates, simulation) {
  const nonLagosCatalog = catalogPrices.filter(
    (entry) =>
      entry.city !== "Lagos" ||
      !Object.prototype.hasOwnProperty.call(marketBases, entry.item)
  );

  const updatedCatalog = nonLagosCatalog.map((entry) => {
    const commodity = getCommodityName(entry.item);
    const unitPrice = getApiUsdPrice(entry.item, commodityRates);
    const currencyRate = rates[entry.currency] ?? fallbackCatalogUsdRates[entry.currency] ?? 1;
    const quantity = entry.item.includes("(50kg)") ? 50 : 1;

    if (unitPrice !== null) {
      const usdPrice = unitPrice * quantity;
      return {
        ...entry,
        price: usdPrice * currencyRate,
        usdPrice,
        history: [...entry.history.slice(0, -1), usdPrice * currencyRate],
        priceSource: commodityRates[commodity] === fallbackCommodityPrices[commodity]
          ? "estimate"
          : "commodity-api",
        live: true,
      };
    }

    const usdPrice =
      entry.currency === "USD"
        ? entry.price
        : entry.price / (fallbackCatalogUsdRates[entry.currency] ?? 1);
    return {
      ...entry,
      price: usdPrice * currencyRate,
      usdPrice,
      priceSource: "catalog-estimate",
      live: false,
    };
  });

  const globalBenchmarks = ["Wheat", "Maize"].map((item) => {
    const usdPrice = commodityRates[item] ?? fallbackCommodityPrices[item];
    const history = Array.from({ length: 7 }, (_, index) =>
      index === 6 ? usdPrice : Number((usdPrice * (0.96 + index * 0.008)).toFixed(2))
    );
    return {
      id: `global-${item.toLowerCase()}`,
      item,
      country: "Global",
      city: "Global",
      market: "Global commodity benchmark (per kg)",
      price: usdPrice,
      currency: "USD",
      trend: "stable",
      verifiedCount: 0,
      verifiedToday: 0,
      usdPrice,
      priceSource:
        commodityRates[item] === fallbackCommodityPrices[item] ? "estimate" : "commodity-api",
      live: true,
      history,
    };
  });

  return [...makeLagosPrices(simulation, rates), ...updatedCatalog, ...globalBenchmarks];
}

function makeSupabasePrices(rows, rates, histories = []) {
  return rows.flatMap((row, index) => {
    const item = row.item ?? row.item_name ?? row.product;
    const city = row.city ?? row.location;
    const market = row.market ?? row.market_name;
    const country = row.country ?? "Nigeria";
    const currency = String(row.currency ?? row.currency_code ?? "NGN").toUpperCase();
    const price = Number(row.price ?? row.price_amount);

    if (
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
    return [{
      id: String(row.id ?? `supabase-price-${index}`),
      item,
      country,
      city,
      market,
      unit: row.unit ?? row.pack_size ?? row.quantity ?? "",
      price,
      currency,
      trend: "stable",
      verifiedCount: Number(row.verified_count ?? row.report_count ?? 0),
      reportCount: Number(row.report_count ?? 0),
      sellerId: row.seller_id ?? null,
      photoUrl: row.photo_url ?? null,
      verifiedToday: 0,
      usdPrice,
      priceSource: "supabase",
      createdAt: row.created_at ?? null,
      history: history.map((entry) => entry.price),
      historyDates: history.map((entry) => entry.date),
      historySource: history.length >= 2 ? "verified" : null,
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
  return { rows, history: history ?? [], error: null };
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

async function fetchCommodityPrices(signal) {
  const accessKey = import.meta.env.VITE_COMMODITY_API_KEY?.trim();
  if (!accessKey) return fallbackCommodityPrices;

  const url = new URL(COMMODITY_URL);
  url.searchParams.set("access_key", accessKey);
  url.searchParams.set("base", "USD");
  url.searchParams.set("symbols", "RICE,WHEAT,CORN,TOMATOES");

  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Commodity service returned ${response.status}`);
  const data = await response.json();
  if (data.success !== true || !data.rates) {
    throw new Error("Commodity service returned an invalid response");
  }

  const result = { ...fallbackCommodityPrices };
  for (const [item, symbol] of [
    ["Rice", "RICE"],
    ["Wheat", "WHEAT"],
    ["Maize", "CORN"],
    ["Tomatoes", "TOMATOES"],
  ]) {
    const quote = Number(data.rates[symbol]);
    if (Number.isFinite(quote) && quote > 0) result[item] = 1 / quote;
  }
  return result;
}

function randomStep() {
  return (Math.random() * 2 - 1) / 100;
}

export function useLivePrices() {
  const cachedPrices = useMemo(() => getCachedPrices(), []);
  const [rates, setRates] = useState(cachedPrices?.rates ?? fallbackCatalogUsdRates);
  const [commodityRates, setCommodityRates] = useState(fallbackCommodityPrices);
  const [simulation, setSimulation] = useState({});
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
        const [nextRates, nextCommodityRates, priceResult] = await Promise.all([
          fetchRates(controller.signal).catch((error) => {
            if (error.name !== "AbortError") console.error("Could not refresh exchange rates:", error);
            return null;
          }),
          fetchCommodityPrices(controller.signal).catch((error) => {
            if (error.name !== "AbortError") console.error("Could not refresh commodity prices:", error);
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
        if (nextCommodityRates) setCommodityRates(nextCommodityRates);
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
    const simulationTimer = window.setInterval(() => {
      setSimulation((previous) =>
        Object.fromEntries(
          Object.keys(marketBases).flatMap((item) =>
            lagosMarkets.map((market) => {
              const key = `${item}-${market}`;
              const previousChange = previous[key]?.change ?? 0;
            const change = randomStep();
              return [
                key,
                {
                  change,
                  trend: change > previousChange ? "up" : change < previousChange ? "down" : "stable",
                },
              ];
            })
          )
        )
      );
      setLastUpdated(Date.now());
    }, SIMULATION_MS);
    const ageTimer = window.setInterval(() => setNow(Date.now()), 1_000);

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      window.clearInterval(simulationTimer);
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
  const prices = useMemo(
    () => supabasePrices.length
      ? supabasePrices
      : makePrices(rates, commodityRates, simulation),
    [supabasePrices, rates, commodityRates, simulation]
  );
  const dataSource = supabasePrices.length ? "supabase" : "simulation";
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
    dataSource,
    dataError: visibleDataError,
  };
}
