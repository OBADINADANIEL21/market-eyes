import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

export default function VerifiedSellers({ goTo }) {
  const { user } = useAuth();
  const [sellers, setSellers] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    supabase.from("seller_profiles").select("id,shop_name,market,trust_score,total_posts,verified")
      .order("trust_score", { ascending: false }).order("total_posts", { ascending: false }).limit(50)
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) {
          console.error("Could not load sellers:", queryError);
          setError("Seller listings are temporarily unavailable.");
        } else setSellers(data ?? []);
      });
    return () => { active = false; };
  }, []);

  const messageSeller = async (seller) => {
    const { data, error: chatError } = await supabase.rpc("get_or_create_conversation", { p_other_user: seller.id });
    if (chatError) {
      console.error("Could not start seller chat:", chatError);
      setError("Could not open this seller chat. Please try again.");
    } else goTo("chat", { chatId: data });
  };

  return <div className="mx-auto max-w-4xl px-4 py-8">
    <h1 className="text-3xl font-extrabold">Top sellers</h1>
    <p className="my-2 text-gray-600">Ranked by community verification score. Rankings are based on recorded buyer verifications, not a guarantee of quality.</p>
    {error && <p role="alert" className="my-3 rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}
    {sellers.length ? <ol className="mt-5 space-y-3">{sellers.map((seller, index) => <li key={seller.id} className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow">
      <span className="text-2xl">{["🥇", "🥈", "🥉"][index] || `#${index + 1}`}</span>
      <div className="min-w-0 flex-1"><div className="font-bold">{seller.shop_name}{seller.verified && <span className="ml-2 text-blue-600">✓ Verified</span>}</div><div className="text-sm text-gray-500">{seller.market || "Market not set"} · {seller.total_posts} posts</div><div className="mt-1 text-sm font-semibold text-brand">Trust score {seller.trust_score}/100</div></div>
      {user && seller.id !== user.id && <button onClick={() => void messageSeller(seller)} className="rounded-xl bg-brand px-3 py-2 text-sm font-bold text-white">Message</button>}
    </li>)}</ol> : !error && <p className="mt-5 rounded-xl bg-white p-5 text-gray-600">No seller profiles are available yet.</p>}
  </div>;
}
