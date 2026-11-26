import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { listQueuedItems } from "../lib/offlineQueue";
import { normalizeHttpsUrl, normalizeNigerianWhatsApp } from "../lib/whatsapp";

const initialSettings = { data_saver: true, auto_download_vn: false, sync_only_wifi: false, notify_message: true, notify_call: true, notify_sound: true, notify_vibrate: true, do_not_disturb: false };

let oneSignalInitPromise;

async function initializeOneSignal(appId) {
  const { default: OneSignal } = await import("react-onesignal");
  if (!oneSignalInitPromise) {
    oneSignalInitPromise = OneSignal.init({
      appId,
      allowLocalhostAsSecureOrigin: true,
      serviceWorkerPath: "/OneSignalSDKWorker.js",
      serviceWorkerParam: { scope: "/" },
    }).catch((error) => {
      oneSignalInitPromise = null;
      throw error;
    });
  }
  await oneSignalInitPromise;
  return OneSignal;
}

function waitForPushSubscription(OneSignal) {
  const subscription = OneSignal.User.PushSubscription;
  if (subscription.optedIn && subscription.id) return Promise.resolve(subscription.id);

  return new Promise((resolve, reject) => {
    let settled = false;
    let timeout;
    const finish = (id, error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      subscription.removeEventListener("change", onChange);
      if (error) reject(error);
      else resolve(id);
    };
    const onChange = (event) => {
      if (event.current.optedIn && event.current.id) finish(event.current.id);
    };

    subscription.addEventListener("change", onChange);
    timeout = window.setTimeout(
      () => finish(null, new Error("Push subscription did not become active in time.")),
      15000
    );
    try {
      Promise.resolve(subscription.optIn()).catch((error) => finish(null, error));
    } catch (error) {
      finish(null, error);
    }
  });
}

export default function Profile({ goTo }) {
  const { user, profile, refreshProfile } = useAuth();
  const [settings, setSettings] = useState(initialSettings);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("success");
  const [queueLength, setQueueLength] = useState(listQueuedItems().length);
  const [pushLoading, setPushLoading] = useState(false);
  const [storeBusy, setStoreBusy] = useState(false);
  const [editingStore, setEditingStore] = useState(false);
  const [storeForm, setStoreForm] = useState({ store_name: "", whatsapp_number: "", show_whatsapp: true, group_link: "" });

  useEffect(() => {
    if (profile) setSettings((current) => ({ ...current, ...profile }));
  }, [profile]);
  useEffect(() => {
    if (profile) setStoreForm({
      store_name: profile.store_name ?? "",
      whatsapp_number: profile.whatsapp_number ?? "",
      show_whatsapp: profile.show_whatsapp ?? true,
      group_link: profile.group_link ?? "",
    });
  }, [profile]);
  useEffect(() => {
    const update = () => setQueueLength(listQueuedItems().length);
    window.addEventListener("market-eye-queue-change", update);
    return () => window.removeEventListener("market-eye-queue-change", update);
  }, []);

  const saveSettings = async (event) => {
    const { name, checked } = event.target;
    const next = { ...settings, [name]: checked };
    setSettings(next);
    setNotice("");
    setNoticeType("success");
    const { error } = await supabase.from("profiles").update({ [name]: checked }).eq("id", user.id);
    if (error) {
      console.error("Could not update profile settings:", error);
      setNotice("Could not save this setting. Please try again.");
      setNoticeType("error");
    } else {
      await refreshProfile();
      setNotice("Settings saved.");
    }
  };

  const saveStore = async (event) => {
    event.preventDefault();
    const storeName = storeForm.store_name.trim();
    const whatsappNumber = normalizeNigerianWhatsApp(storeForm.whatsapp_number);
    const groupLink = normalizeHttpsUrl(storeForm.group_link);
    if (!storeName) {
      setNotice("Enter your store name.");
      setNoticeType("error");
      return;
    }
    if (!whatsappNumber) {
      setNotice("Enter a WhatsApp number beginning with +234 and followed by 10 digits.");
      setNoticeType("error");
      return;
    }
    if (groupLink === null) {
      setNotice("Enter a secure group link beginning with https://.");
      setNoticeType("error");
      return;
    }
    setStoreBusy(true);
    setNotice("");
    try {
      const { error } = await supabase.from("profiles").update({
        store_name: storeName,
        whatsapp_number: whatsappNumber,
        show_whatsapp: storeForm.show_whatsapp,
        group_link: groupLink,
      }).eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      setEditingStore(false);
      setNotice("Store details saved.");
      setNoticeType("success");
    } catch (error) {
      console.error("Could not save seller store details:", error);
      setNotice("Could not save store details. Please try again.");
      setNoticeType("error");
    } finally {
      setStoreBusy(false);
    }
  };

  const enableNotifications = async () => {
    const appId = import.meta.env.VITE_ONESIGNAL_APP_ID;
    if (!appId) {
      setNotice("Push notifications are not configured for this site.");
      setNoticeType("error");
      return;
    }
    if (!user || !("Notification" in window) || !("serviceWorker" in navigator)) {
      setNotice("Push notifications are not supported in this browser session.");
      setNoticeType("error");
      return;
    }
    if (Notification.permission === "denied") {
      setNotice("Notifications are blocked for this site. Open the site settings beside the address bar, allow Notifications, reload, then try again.");
      setNoticeType("error");
      return;
    }
    setPushLoading(true);
    try {
      setNotice("");
      setNoticeType("success");
      const OneSignal = await initializeOneSignal(appId);
      await OneSignal.login(user.id);
      await OneSignal.User.addTag("user_id", user.id);
      await OneSignal.Notifications.requestPermission();
      if (Notification.permission !== "granted") {
        setNotice("Notification permission was not granted. Choose Allow in the browser prompt to enable push.");
        setNoticeType("error");
        return;
      }
      await waitForPushSubscription(OneSignal);
      setNotice("Push is enabled on this browser. Test it with a new message or call while the receiving account is away from MARKET EYE.");
      setNoticeType("success");
    } catch (error) {
      console.error("Could not enable push notifications:", error);
      setNotice(error instanceof Error ? `Could not enable notifications: ${error.message}` : "Could not enable notifications. Check browser permission and try again.");
      setNoticeType("error");
    } finally {
      setPushLoading(false);
    }
  };

  const clearCache = () => {
    localStorage.removeItem("market-eye-price-cache");
    setNotice("Cached prices cleared. Your queued messages and reports were kept.");
    setNoticeType("success");
  };
  const toggles = [
    ["data_saver", "Data Saver"],
    ["auto_download_vn", "Auto-download voice notes"],
    ["sync_only_wifi", "Sync only on Wi-Fi"],
    ["notify_message", "Message notifications"],
    ["notify_call", "Call notifications"],
    ["notify_sound", "Notification sound"],
    ["notify_vibrate", "Vibration"],
    ["do_not_disturb", "Do Not Disturb (10pm–6am)"],
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-extrabold">Profile & settings</h1>
      <section className="my-5 rounded-2xl bg-white p-5 shadow">
        <div className="text-xl font-bold">{profile?.name || user?.email}</div>
        <div className="text-gray-500">{profile?.role || "Buyer"}{profile?.market ? ` · ${profile.market}` : ""}</div>
        {profile?.phone && <div className="text-sm text-gray-500">{profile.phone}</div>}
      </section>
      {profile?.role === "seller" && <section className="mb-5 rounded-2xl bg-white p-5 shadow">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-extrabold">{profile.store_name || "Your store"}</h2>
            <p className="mt-1 text-sm text-gray-600">WhatsApp: {profile.whatsapp_number || "Not set"}</p>
            <p className="mt-1 text-sm text-gray-600">These details appear with your approved price listings.</p>
          </div>
          <button type="button" onClick={() => setEditingStore((current) => !current)} className="rounded-xl border px-4 py-2 font-semibold">{editingStore ? "Cancel" : "Edit Store"}</button>
        </div>
        {editingStore && <form onSubmit={saveStore} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">Store name<input required value={storeForm.store_name} onChange={(event) => setStoreForm((current) => ({ ...current, store_name: event.target.value }))} className="mt-1 w-full rounded-xl border-2 border-gray-200 px-4 py-3" placeholder="e.g. Mama Nkechi Stores" /></label>
          <label className="text-sm font-semibold">WhatsApp number<input required type="tel" value={storeForm.whatsapp_number} onChange={(event) => setStoreForm((current) => ({ ...current, whatsapp_number: event.target.value }))} className="mt-1 w-full rounded-xl border-2 border-gray-200 px-4 py-3" placeholder="+234 801 234 5678" /></label>
          <label className="text-sm font-semibold sm:col-span-2">WhatsApp group link (optional)<input type="url" value={storeForm.group_link} onChange={(event) => setStoreForm((current) => ({ ...current, group_link: event.target.value }))} className="mt-1 w-full rounded-xl border-2 border-gray-200 px-4 py-3" placeholder="https://chat.whatsapp.com/..." /></label>
          <label className="flex items-center gap-3 text-sm font-semibold sm:col-span-2"><input type="checkbox" checked={storeForm.show_whatsapp} onChange={(event) => setStoreForm((current) => ({ ...current, show_whatsapp: event.target.checked }))} className="h-5 w-5 accent-emerald-700" />Show my WhatsApp contact on my price listings</label>
          <button disabled={storeBusy} className="rounded-xl bg-brand px-5 py-3 font-bold text-white disabled:opacity-60 sm:col-span-2">{storeBusy ? "Saving…" : "Save store details"}</button>
        </form>}
      </section>}
      <section className="rounded-2xl bg-white p-5 shadow">
        <h2 className="mb-3 text-xl font-bold">Privacy and data</h2>
        <div className="divide-y">{toggles.map(([name, label]) => <label key={name} className="flex min-h-14 items-center justify-between gap-4 py-3"><span>{label}</span><input type="checkbox" name={name} checked={Boolean(settings[name])} onChange={saveSettings} className="h-5 w-5 accent-emerald-700" /></label>)}</div>
        <p className="my-3 text-sm text-gray-500">Images are compressed to at most 800px and about 200KB before upload. Voice recording/network quality is subject to browser and device support.</p>
        <div className="flex flex-wrap gap-2">
          <div className="w-full">
            <p className="mb-2 text-sm text-gray-600">Allow MARKET EYE to send message and call alerts.</p>
            <button onClick={() => void enableNotifications()} disabled={pushLoading} className="rounded-xl bg-brand px-4 py-3 font-bold text-white">{pushLoading ? "Enabling…" : "Enable push notifications"}</button>
          </div>
          <button onClick={clearCache} className="rounded-xl border px-4 py-3 font-semibold">Clear cached prices</button>
          <button onClick={() => goTo("pending-sync")} className="rounded-xl border px-4 py-3 font-semibold">Pending sync ({queueLength})</button>
        </div>
      </section>
      {notice && <p role={noticeType === "error" ? "alert" : "status"} className={`mt-4 rounded-xl p-3 text-sm ${noticeType === "error" ? "bg-red-50 text-red-900" : "bg-emerald-50 text-emerald-900"}`}>{notice}</p>}
      <section className="mt-5 rounded-2xl bg-white p-5 shadow">
        <h2 className="text-xl font-bold">Data usage</h2>
        <p className="mt-2 text-sm text-gray-600">Usage is estimated by your browser; MARKET EYE does not receive a precise network-byte counter.</p>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-gray-100"><div className="h-full w-1/4 rounded-full bg-brand" /></div>
        <p className="mt-2 text-xs text-gray-500">Price cache: {localStorage.getItem("market-eye-price-cache") ? "available" : "empty"} · Pending offline items: {queueLength}</p>
      </section>
    </div>
  );
}
