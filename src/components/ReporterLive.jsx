import { useMemo } from "react";

function updatedAgo(createdAt, now) {
  const minutes = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60_000));
  return minutes < 1 ? "Updated just now" : `Updated ${minutes} min ago`;
}

export default function ReporterLive({ prices, now = Date.now() }) {
  const reporters = useMemo(() => {
    const latestBySeller = new Map();
    prices
      .filter((entry) => entry.priceSource === "supabase" && entry.sellerId && entry.storeName && now - new Date(entry.createdAt ?? "").getTime() <= 30 * 60_000)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .forEach((entry) => {
        if (!latestBySeller.has(entry.sellerId)) latestBySeller.set(entry.sellerId, entry);
      });
    return [...latestBySeller.values()];
  }, [prices, now]);

  return <section className="mx-auto max-w-7xl px-4 pb-6" aria-labelledby="reporters-live-title">
    <div className="rounded-2xl bg-white p-5 shadow">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="reporters-live-title" className="text-xl font-extrabold">Reporters live</h2>
        <p className="text-sm text-gray-500">Approved seller updates from the last 30 minutes</p>
      </div>
      {reporters.length ? <ul className="mt-4 flex gap-3 overflow-x-auto pb-2">
        {reporters.map((entry) => <li key={entry.sellerId} className="min-w-52 rounded-xl border p-3">
          <div className="font-bold">{entry.storeName}</div>
          <div className="text-sm text-gray-600">{entry.sellerMarket || entry.market}</div>
          <div className="mt-1 text-xs text-gray-500">{updatedAgo(entry.createdAt, now)}</div>
        </li>)}
      </ul> : <p className="mt-3 text-sm text-gray-500">No approved seller updates in the last 30 minutes.</p>}
    </div>
  </section>;
}
