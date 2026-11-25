import { useEffect, useState } from "react";
import { listQueuedItems, syncOfflineQueue } from "../lib/offlineQueue";
import { useAuth } from "../context/AuthContext";

export default function PendingSync() {
  const { profile } = useAuth();
  const [items, setItems] = useState(listQueuedItems);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const update = () => setItems(listQueuedItems());
    window.addEventListener("market-eye-queue-change", update);
    return () => window.removeEventListener("market-eye-queue-change", update);
  }, []);
  const retry = async () => {
    setBusy(true);
    setNotice("");
    const result = await syncOfflineQueue({ syncOnlyWifi: profile?.sync_only_wifi });
    setItems(listQueuedItems());
    setNotice(result.deferred ? "Waiting for a Wi-Fi connection." : `${result.synced} synced · ${result.failed} still pending.`);
    setBusy(false);
  };
  return <div className="mx-auto max-w-3xl px-4 py-8">
    <h1 className="text-3xl font-extrabold">Pending sync</h1>
    <p className="my-3 text-gray-600">Items saved on this device while offline will retry when your connection is back.</p>
    {notice && <p role="status" className="mb-3 rounded-xl bg-emerald-50 p-3">{notice}</p>}
    {items.length > 0 ? <ul className="space-y-3">{items.map((item) => <li key={item.id} className="rounded-xl bg-white p-4 shadow"><b className="capitalize">{item.type.replace("_", " ")}</b><span className="ml-2 text-sm text-amber-700">Pending</span><p className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleString()}</p></li>)}</ul> : <p className="rounded-xl bg-white p-5">No pending items.</p>}
    <button disabled={busy || !navigator.onLine || items.length === 0} onClick={() => void retry()} className="mt-5 rounded-xl bg-brand px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? "Syncing…" : "Retry sync"}</button>
  </div>;
}
