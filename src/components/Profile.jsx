import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { listQueuedItems } from "../lib/offlineQueue";

const initialSettings = { data_saver: true, auto_download_vn: false, sync_only_wifi: false, notify_message: true, notify_call: true, notify_sound: true, notify_vibrate: true, do_not_disturb: false };

export default function Profile({ goTo }) {
  const { user, profile, refreshProfile } = useAuth();
  const [settings, setSettings] = useState(initialSettings);
  const [notice, setNotice] = useState("");
  const [queueLength, setQueueLength] = useState(listQueuedItems().length);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    if (profile) setSettings((current) => ({ ...current, ...profile }));
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
    const { error } = await supabase.from("profiles").update({ [name]: checked }).eq("id", user.id);
    if (error) {
      console.error("Could not update profile settings:", error);
      setNotice("Could not save this setting. Please try again.");
    } else {
      await refreshProfile();
      setNotice("Settings saved.");
    }
  };

  const enableNotifications = async () => {
    const appId = import.meta.env.VITE_ONESIGNAL_APP_ID;
    if (!appId || !user || !("Notification" in window)) {
      setNotice("Push notifications are not configured for this site.");
      return;
    }
    setPushLoading(true);
    try {
      const { default: OneSignal } = await import("react-onesignal");
      await OneSignal.init({
        appId,
        allowLocalhostAsSecureOrigin: true,
        serviceWorkerPath: "/sw.js",
        serviceWorkerParam: { scope: "/" },
      });
      await OneSignal.login(user.id);
      await OneSignal.User.addTag("user_id", user.id);
      await OneSignal.Notifications.requestPermission();
      const playerId = OneSignal.User.PushSubscription.id;
      if (playerId) {
        const { error } = await supabase.from("profiles").update({ push_player_id: playerId }).eq("id", user.id);
        if (error) throw error;
      }
      setNotice("Notification preference saved in your browser.");
    } catch (error) {
      console.error("Could not enable push notifications:", error);
      setNotice("Could not enable notifications. Check browser permission and try again.");
    } finally {
      setPushLoading(false);
    }
  };

  const clearCache = () => {
    localStorage.removeItem("market-eye-price-cache");
    setNotice("Cached prices cleared. Your queued messages and reports were kept.");
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
      {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
      <section className="mt-5 rounded-2xl bg-white p-5 shadow">
        <h2 className="text-xl font-bold">Data usage</h2>
        <p className="mt-2 text-sm text-gray-600">Usage is estimated by your browser; MARKET EYE does not receive a precise network-byte counter.</p>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-gray-100"><div className="h-full w-1/4 rounded-full bg-brand" /></div>
        <p className="mt-2 text-xs text-gray-500">Price cache: {localStorage.getItem("market-eye-price-cache") ? "available" : "empty"} · Pending offline items: {queueLength}</p>
      </section>
    </div>
  );
}
