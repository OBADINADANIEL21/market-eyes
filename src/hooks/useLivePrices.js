import { useEffect, useMemo, useState } from "react";
import { prices as catalogPrices, usdRates as fallbackRates } from "../data";

const RATE_URL = "https://open.er-api.com/v6/latest/USD";
const COMMODITY_URL = "https://commodities-api.com/api/latest";
const REFRESH_MS = 30_000;
const SIMULATION_MS = 15_000;

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
  const [rates, setRates] = useState(fallbackCatalogUsdRates);
  const [commodityRates, setCommodityRates] = useState(fallbackCommodityPrices);
  const [simulation, setSimulation] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 10_000);

      try {
        const [nextRates, nextCommodityRates] = await Promise.all([
          fetchRates(controller.signal).catch((error) => {
            if (error.name !== "AbortError") console.error("Could not refresh exchange rates:", error);
            return null;
          }),
          fetchCommodityPrices(controller.signal).catch((error) => {
            if (error.name !== "AbortError") console.error("Could not refresh commodity prices:", error);
            return null;
          }),
        ]);

        if (!active) return;
        if (nextRates && Object.values(nextRates).every(Number.isFinite)) {
          setRates(nextRates);
        }
        if (nextCommodityRates) setCommodityRates(nextCommodityRates);
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

  const prices = useMemo(
    () => makePrices(rates, commodityRates, simulation),
    [rates, commodityRates, simulation]
  );
  const trend = useMemo(
    () => Object.fromEntries(prices.map((entry) => [entry.id, entry.trend])),
    [prices]
  );

  return { prices, rates, loading, lastUpdated, trend, now };
}
