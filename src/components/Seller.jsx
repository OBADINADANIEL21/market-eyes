import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { fileAsDataUrl, uploadImage } from "../lib/uploads";
import { queueItem } from "../lib/offlineQueue";
import { readLocalCache, writeLocalCache } from "../lib/localCache";

const blank = { item: "", price: "", unit: "", market: "", city: "", country: "Nigeria", currency: "NGN" };
const input = "w-full rounded-xl border-2 border-gray-200 px-4 py-3";

export default function Seller({ goTo }) {
  const { user, profile } = useAuth();
  const [form, setForm] = useState({ ...blank, market: profile?.market ?? "" });
  const [photo, setPhoto] = useState(null);
  const [posts, setPosts] = useState([]);
  const [sellerProfile, setSellerProfile] = useState(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: postRows, error: postError }, { data: seller, error: sellerError }] = await Promise.all([
      supabase.from("seller_posts").select("id,item,price,unit,market,city,country,currency,status,created_at,photo_url").eq("seller_id", user.id).eq("country", "Nigeria").order("created_at", { ascending: false }).limit(10),
      supabase.from("seller_profiles").select("shop_name,trust_score,total_posts,market,verified").eq("id", user.id).maybeSingle(),
    ]);
    if (postError || sellerError) {
      console.error("Could not load seller dashboard:", postError ?? sellerError);
      const cached = readLocalCache(`market-eye-seller-${user.id}`);
      if (cached) {
        setPosts(cached.posts ?? []);
        setSellerProfile(cached.sellerProfile ?? null);
        setNotice("Offline: showing the last saved seller dashboard.");
      } else setNotice("Could not load seller details. Please refresh and try again.");
      return;
    }
    setPosts(postRows ?? []);
    setSellerProfile(seller);
    writeLocalCache(`market-eye-seller-${user.id}`, { posts: postRows ?? [], sellerProfile: seller });
  }, [user.id]);

  useEffect(() => { void load(); }, [load]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      let photo_url = null;
      let photoDataUrl;
      if (photo && navigator.onLine) photo_url = await uploadImage(photo, "price-proofs", `${user.id}/${crypto.randomUUID()}.jpg`);
      else if (photo) photoDataUrl = await fileAsDataUrl(photo);
      const post = {
        seller_id: user.id,
        item: form.item.trim(),
        price: Number(form.price),
        unit: form.unit.trim(),
        market: form.market.trim(),
        city: form.city.trim(),
        country: "Nigeria",
        currency: "NGN",
        photo_url,
      };
      if (!navigator.onLine) {
        await queueItem("seller_post", { ...post, ...(photoDataUrl ? { photoDataUrl } : {}) });
        setNotice("Saved on this device. It will sync when you are online.");
      } else {
        const { error } = await supabase.from("seller_posts").insert(post);
        if (error) throw error;
        setNotice("Price submitted. It will appear after review.");
        await load();
      }
      setForm({ ...blank, market: profile?.market ?? "" });
      setPhoto(null);
    } catch (error) {
      console.error("Could not submit seller price:", error);
      setNotice("Could not submit the price. Please check the details and try again.");
    } finally { setBusy(false); }
  };

  return <div className="mx-auto max-w-5xl px-4 py-8">
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-extrabold">Seller dashboard</h1><button onClick={() => goTo("sellers")} className="rounded-xl border px-4 py-2 font-semibold">Top sellers</button></header>
    <section className="my-5 grid gap-3 sm:grid-cols-3">
      {[["Shop", sellerProfile?.shop_name || profile?.name], ["Trust score", `${sellerProfile?.trust_score ?? 0}/100`], ["Price posts", sellerProfile?.total_posts ?? posts.length]].map(([label, value]) => <div key={label} className="rounded-2xl bg-white p-5 shadow"><div className="text-sm text-gray-500">{label}</div><div className="text-xl font-extrabold text-brand">{value}</div></div>)}
    </section>
    <form onSubmit={submit} className="grid gap-4 rounded-2xl bg-white p-5 shadow md:grid-cols-2">
      <h2 className="text-xl font-bold md:col-span-2">Post a new price</h2>
      {[
        ["item", "Item", "e.g. Rice"],
        ["price", "Price", ""],
        ["unit", "Unit / pack size", "e.g. 1kg, bag"],
        ["market", "Market", "Market name"],
        ["city", "City", "City"],
      ].map(([name, label, placeholder]) => <label key={name} className="text-sm font-semibold">{label}<input required className={input} name={name} type={name === "price" ? "number" : "text"} min={name === "price" ? "0.01" : undefined} step={name === "price" ? "any" : undefined} placeholder={placeholder} value={form[name]} onChange={(event) => setForm((prev) => ({ ...prev, [name]: event.target.value }))} /></label>)}
      <p className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">Nigeria · NGN (Naira)</p>
      <label className="text-sm font-semibold">Photo proof (optional)<input className={input} type="file" accept="image/*" capture="environment" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} /></label>
      {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 md:col-span-2">{notice}</p>}
      <button disabled={busy} className="rounded-xl bg-brand px-5 py-3 font-bold text-white disabled:opacity-60 md:col-span-2">{busy ? "Submitting…" : "Submit for review"}</button>
    </form>
    <section className="mt-8">
      <h2 className="mb-3 text-2xl font-bold">Your latest price posts</h2>
      {posts.length ? <ul className="space-y-3">{posts.map((post) => <li key={post.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow"><div><b>{post.item}</b> · {post.price} {post.currency} / {post.unit}<div className="text-sm text-gray-500">{post.market}, {post.city}</div><div className="text-xs text-gray-400">{new Date(post.created_at).toLocaleString()}</div></div><span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold capitalize">{post.status}</span></li>)}</ul> : <p className="rounded-xl bg-white p-5 text-gray-500">No price posts yet.</p>}
    </section>
  </div>;
}
