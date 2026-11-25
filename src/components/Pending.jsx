import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Pending() {
  const [posts, setPosts] = useState([]);
  const [reports, setReports] = useState([]);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);

  const load = useCallback(async () => {
    const [postResult, reportResult] = await Promise.all([
      supabase.from("seller_posts").select("id,seller_id,item,price,unit,market,city,country,currency,photo_url,created_at").eq("status", "pending").order("created_at", { ascending: true }).limit(100),
      supabase.from("reports").select("id,name,item,price,unit,market,city,country,currency,photo_url,created_at").eq("status", "pending").order("created_at", { ascending: true }).limit(100),
    ]);
    const error = postResult.error ?? reportResult.error;
    if (error) {
      console.error("Could not load pending reviews:", error);
      setNotice("Could not load the review queue. Check your moderator access and try again.");
      return;
    }
    setPosts(postResult.data ?? []);
    setReports(reportResult.data ?? []);
  }, []);

  useEffect(() => { void load(); }, [load, reload]);

  const review = async (table, id, action) => {
    setBusyId(id);
    setNotice("");
    try {
      const rpc = table === "seller_posts" ? "review_seller_post" : "review_price_report";
      const { error } = await supabase.rpc(rpc, { p_submission_id: id, p_decision: action });
      if (error) throw error;
      setNotice(`${action === "approve" ? "Approved" : "Rejected"} successfully.`);
      setReload((count) => count + 1);
    } catch (error) {
      console.error("Could not review submission:", error);
      setNotice("Could not update this submission. Please try again.");
    } finally { setBusyId(""); }
  };

  const SubmissionList = ({ title, items, table }) => <section className="mt-7">
    <h2 className="mb-3 text-2xl font-bold">{title} ({items.length})</h2>
    {items.length ? <ul className="space-y-3">{items.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-4 shadow">
      <div><b>{item.item}</b> · {item.price} {item.currency} / {item.unit}<div className="text-sm text-gray-500">{item.market}, {item.city}, {item.country}</div><div className="text-xs text-gray-400">Submitted {new Date(item.created_at).toLocaleString()}{item.name ? ` by ${item.name}` : ""}</div>{item.photo_url && <a className="text-sm font-semibold text-brand underline" href={item.photo_url} target="_blank" rel="noreferrer">View photo proof</a>}</div>
      <div className="flex gap-2"><button disabled={busyId === item.id} onClick={() => void review(table, item.id, "approve")} className="rounded-lg bg-emerald-700 px-3 py-2 font-bold text-white">Approve</button><button disabled={busyId === item.id} onClick={() => void review(table, item.id, "reject")} className="rounded-lg bg-red-700 px-3 py-2 font-bold text-white">Reject</button></div>
    </li>)}</ul> : <p className="rounded-xl bg-white p-5 text-gray-500">Nothing needs review right now.</p>}
  </section>;

  return <div className="mx-auto max-w-5xl px-4 py-8">
    <h1 className="text-3xl font-extrabold">Pending review</h1>
    <p className="my-2 text-gray-600">Only authorized moderators can approve or reject prices. Approval updates listings and adds a history entry.</p>
    {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3">{notice}</p>}
    <SubmissionList title="Seller price posts" items={posts} table="seller_posts" />
    <SubmissionList title="Community reports" items={reports} table="reports" />
  </div>;
}
