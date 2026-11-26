import { useCallback, useEffect, useMemo, useState } from "react";
import { formatPrice } from "../data";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

function dayKey(entry) {
  const timestamp = new Date(entry.createdAt ?? "").getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : "";
}

export default function PriceDebate({ entry, prices }) {
  const { user } = useAuth();
  const [votes, setVotes] = useState({});
  const [myVote, setMyVote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const priceDate = dayKey(entry);
  const candidates = useMemo(() => prices
    .filter((price) => price.priceSource === "supabase" &&
      price.item === entry.item &&
      price.market === entry.market &&
      dayKey(price) === priceDate)
    .filter((price, index, list) => list.findIndex((other) => other.price === price.price) === index)
    .sort((a, b) => String(a.id).localeCompare(String(b.id))), [entry.item, entry.market, priceDate, prices]);

  const loadVotes = useCallback(async () => {
    if (candidates.length < 2 || !supabase) return;
    const priceIds = candidates.map((price) => Number(price.id));
    const [{ data: totals, error: totalsError }, ownResult] = await Promise.all([
      supabase.from("price_vote_totals").select("price_id,vote_count").in("price_id", priceIds),
      user
        ? supabase.from("price_votes").select("price_id").eq("voter_id", user.id).eq("item", entry.item).eq("market", entry.market).eq("price_date", priceDate).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (totalsError || ownResult.error) {
      console.warn("Could not load price debate votes:", totalsError ?? ownResult.error);
      setNotice("Votes are temporarily unavailable.");
      return;
    }
    setVotes(Object.fromEntries((totals ?? []).map((vote) => [String(vote.price_id), vote.vote_count])));
    setMyVote(ownResult.data?.price_id ?? null);
  }, [candidates, entry.item, entry.market, priceDate, user]);

  useEffect(() => { void loadVotes(); }, [loadVotes]);

  if (candidates.length < 2 || String(candidates[0].id) !== String(entry.id)) return null;

  const castVote = async (price) => {
    if (!user || busy) return;
    if (!supabase) {
      setNotice("Price voting is unavailable because the database is not configured.");
      return;
    }
    setBusy(true);
    setNotice("");
    const { error } = await supabase.rpc("cast_price_vote", {
      p_price_id: Number(price.id),
      p_item: entry.item,
      p_market: entry.market,
      p_price_date: priceDate,
    });
    if (error) {
      console.error("Could not cast price debate vote:", error);
      setNotice(error.message.includes("function") ? "Run the market-tools SQL migration before voting." : "Your vote could not be saved. Try again.");
    } else {
      setMyVote(Number(price.id));
      await loadVotes();
    }
    setBusy(false);
  };

  const top = candidates.reduce((best, price) => (votes[String(price.id)] ?? 0) > (votes[String(best.id)] ?? 0) ? price : best, candidates[0]);
  const tied = candidates.filter((price) => (votes[String(price.id)] ?? 0) === (votes[String(top.id)] ?? 0)).length > 1;

  return <section className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3" aria-label="Price debate">
    <h4 className="font-bold text-amber-950">Different prices reported today. Which one is correct?</h4>
    <ul className="mt-2 space-y-2">{candidates.map((price) => <li key={price.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-2">
      <span className="text-sm font-bold">{formatPrice(price.price, price.currency)}</span>
      <span className="text-xs text-gray-600">{votes[String(price.id)] ?? 0} votes</span>
      {String(top.id) === String(price.id) && !tied && <span className="rounded-full bg-emerald-700 px-2 py-1 text-xs font-bold text-white">Main price</span>}
      {user && supabase ? <button type="button" disabled={busy || Number(myVote) === Number(price.id)} onClick={() => void castVote(price)} className="rounded-lg border border-brand px-3 py-1 text-xs font-bold text-brand disabled:opacity-50">{Number(myVote) === Number(price.id) ? "Your vote" : "Vote"}</button> : <span className="text-xs text-gray-500">{user ? "Voting unavailable" : "Log in to vote"}</span>}
    </li>)}</ul>
    {notice && <p role="status" className="mt-2 text-xs text-gray-700">{notice}</p>}
  </section>;
}
