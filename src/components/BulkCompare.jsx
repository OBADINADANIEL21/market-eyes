import { useMemo, useState } from "react";
import { formatPrice, getItemEmoji } from "../data";
import { useLivePrices } from "../hooks/useLivePrices";

const checkboxClass = "h-4 w-4 accent-emerald-700";

function toggleLimited(values, setValues, value, limit) {
  if (values.includes(value)) setValues(values.filter((current) => current !== value));
  else if (values.length < limit) setValues([...values, value]);
}

export default function BulkCompare() {
  const { prices, loading, loadingMore, hasMore, loadMore, dataSource } = useLivePrices();
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectedMarkets, setSelectedMarkets] = useState([]);
  const [quantities, setQuantities] = useState({});
  const realPrices = dataSource === "supabase" ? prices : [];
  const items = useMemo(() => [...new Set(realPrices.map((entry) => entry.item))].sort(), [realPrices]);
  const markets = useMemo(() => [...new Set(realPrices.map((entry) => entry.market))].sort(), [realPrices]);

  const latestEntry = (item, market) => realPrices
    .filter((entry) => entry.item === item && entry.market === market)
    .reduce((latest, entry) => {
      if (!latest) return entry;
      return new Date(entry.createdAt ?? 0) > new Date(latest.createdAt ?? 0) ? entry : latest;
    }, null);

  const comparisonRows = useMemo(() => selectedItems.map((item) => {
    const entries = selectedMarkets.map((market) => ({ market, entry: latestEntry(item, market) }));
    const available = entries.filter(({ entry }) => entry);
    const cheapest = available.reduce((best, current) => {
      const currentPrice = current.entry.usdPrice ?? current.entry.price;
      const bestPrice = best?.entry.usdPrice ?? best?.entry.price;
      return bestPrice === undefined || currentPrice < bestPrice ? current : best;
    }, null);
    return { item, entries, cheapestMarket: cheapest?.market ?? null };
  }), [selectedItems, selectedMarkets, realPrices]);

  const budgets = useMemo(() => selectedMarkets.map((market) => {
    let total = 0;
    let currency = null;
    let complete = selectedItems.length > 0;
    for (const item of selectedItems) {
      const entry = latestEntry(item, market);
      if (!entry || (currency && currency !== entry.currency)) {
        complete = false;
        break;
      }
      currency = entry.currency;
      total += entry.price * (quantities[item] ?? 1);
    }
    return { market, total, currency, complete };
  }), [selectedItems, selectedMarkets, quantities, realPrices]);

  const completeBudgets = budgets.filter((budget) => budget.complete);
  const sharedBudgetCurrency = completeBudgets.every((budget) => budget.currency === completeBudgets[0]?.currency)
    ? completeBudgets[0]?.currency
    : null;
  const cheapestBudget = completeBudgets.filter((budget) => budget.currency === sharedBudgetCurrency && sharedBudgetCurrency)
    .reduce((best, budget) => !best || budget.total < best.total ? budget : best, null);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-extrabold">Bulk price check</h1>
      <p className="mt-2 text-gray-600">Compare up to 10 items across 3 markets using current database listings.</p>
      {dataSource !== "supabase" && <p role="status" className="my-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">There are no live database listings to compare right now. Estimates are not used in this tool.</p>}
      {loading && <p role="status" className="my-4 text-gray-600">Loading market listings…</p>}
      <div className="my-5 grid gap-5 md:grid-cols-2">
        <section className="rounded-2xl bg-white p-5 shadow">
          <h2 className="mb-3 text-lg font-bold">Choose up to 10 items ({selectedItems.length}/10)</h2>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {items.map((item) => <label key={item} className="flex items-center gap-3 rounded-lg p-2 hover:bg-gray-50">
              <input type="checkbox" className={checkboxClass} checked={selectedItems.includes(item)} disabled={!selectedItems.includes(item) && selectedItems.length >= 10} onChange={() => toggleLimited(selectedItems, setSelectedItems, item, 10)} />
              <span>{getItemEmoji(item)} {item}</span>
            </label>)}
            {!items.length && !loading && <p className="text-sm text-gray-500">No real item listings are available.</p>}
          </div>
        </section>
        <section className="rounded-2xl bg-white p-5 shadow">
          <h2 className="mb-3 text-lg font-bold">Choose up to 3 markets ({selectedMarkets.length}/3)</h2>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {markets.map((market) => <label key={market} className="flex items-center gap-3 rounded-lg p-2 hover:bg-gray-50">
              <input type="checkbox" className={checkboxClass} checked={selectedMarkets.includes(market)} disabled={!selectedMarkets.includes(market) && selectedMarkets.length >= 3} onChange={() => toggleLimited(selectedMarkets, setSelectedMarkets, market, 3)} />
              <span>{market}</span>
            </label>)}
            {!markets.length && !loading && <p className="text-sm text-gray-500">No real market listings are available.</p>}
          </div>
        </section>
      </div>
      {hasMore && <button type="button" disabled={loadingMore} onClick={() => void loadMore()} className="mb-5 rounded-xl border px-4 py-2 font-semibold">{loadingMore ? "Loading…" : "Load more listings"}</button>}

      {comparisonRows.length > 0 && selectedMarkets.length > 0 && <section className="overflow-x-auto rounded-2xl bg-white p-4 shadow">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead><tr className="border-b"><th className="p-3">Item and quantity</th>{selectedMarkets.map((market) => <th key={market} className="p-3">{market}</th>)}</tr></thead>
          <tbody>{comparisonRows.map(({ item, entries, cheapestMarket }) => <tr key={item} className="border-b last:border-0">
            <th className="p-3 align-top">
              <div>{getItemEmoji(item)} {item}</div>
              <label className="mt-2 flex items-center gap-2 text-xs font-medium text-gray-600">Qty
                <input type="number" min="1" step="1" value={quantities[item] ?? 1} onChange={(event) => setQuantities((current) => ({ ...current, [item]: Math.max(1, Math.floor(Number(event.target.value) || 1)) }))} className="w-16 rounded border px-2 py-1 text-center" aria-label={`${item} quantity`} />
              </label>
            </th>
            {entries.map(({ market, entry }) => <td key={market} className="p-3 align-top">
              {entry ? <><div className="font-bold">{formatPrice(entry.price, entry.currency)} / {entry.unit || "unit"}</div>{market === cheapestMarket && <span className="mt-1 inline-block rounded-full bg-emerald-600 px-2 py-1 text-xs font-bold text-white">CHEAPEST</span>}</> : <span className="text-sm text-gray-400">No listing</span>}
            </td>)}
          </tr>)}</tbody>
        </table>
      </section>}

      {selectedItems.length > 0 && selectedMarkets.length > 0 && <section className="mt-6">
        <h2 className="mb-3 text-xl font-bold">My list budget</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {budgets.map(({ market, total, currency, complete }) => <article key={market} className={`rounded-2xl p-4 shadow ${cheapestBudget?.market === market ? "bg-emerald-100 text-emerald-950" : "bg-white"}`}>
            <h3 className="font-bold">{market}{cheapestBudget?.market === market && <span className="ml-2 text-xs">CHEAPEST</span>}</h3>
            <p className="mt-2 text-xl font-extrabold">{complete ? formatPrice(total, currency) : "Not all items have a comparable price"}</p>
          </article>)}
        </div>
      </section>}
    </div>
  );
}
