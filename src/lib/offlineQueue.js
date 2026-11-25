import { supabase } from "./supabase";
import { uploadAudioDataUrl, uploadImageDataUrl } from "./uploads";
import { deleteOfflineMedia, getOfflineMedia, saveOfflineMedia } from "./offlineMedia";

const QUEUE_KEY = "market-eye-offline-queue";

export function listQueuedItems() {
  try {
    const data = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function queueItem(type, payload) {
  const items = listQueuedItems();
  const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const queuedPayload = { ...payload };
  for (const field of ["photoDataUrl", "audioDataUrl"]) {
    if (queuedPayload[field]) {
      const key = `${id}:${field}`;
      await saveOfflineMedia(key, queuedPayload[field]);
      delete queuedPayload[field];
      queuedPayload[`${field}Key`] = key;
    }
  }
  const item = { id, type, payload: queuedPayload, createdAt: new Date().toISOString(), sync_status: "pending" };
  localStorage.setItem(QUEUE_KEY, JSON.stringify([...items, item]));
  window.dispatchEvent(new CustomEvent("market-eye-queue-change"));
  return item;
}

function saveQueue(items) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("market-eye-queue-change"));
}

async function uploadQueuedPhoto(payload, bucket, column) {
  if (!payload.photoDataKey) return payload;
  const photoDataUrl = await getOfflineMedia(payload.photoDataKey);
  if (!photoDataUrl) throw new Error("Queued photo is missing from this device.");
  const owner = payload.user_id ?? payload.seller_id ?? "reports";
  const photo_url = await uploadImageDataUrl(photoDataUrl, bucket, `${owner}/${crypto.randomUUID()}.jpg`);
  const { photoDataKey, ...rest } = payload;
  return { ...rest, [column]: photo_url };
}

async function uploadQueuedAudio(payload) {
  if (!payload.audioDataKey) return payload;
  const audioDataUrl = await getOfflineMedia(payload.audioDataKey);
  if (!audioDataUrl) throw new Error("Queued voice note is missing from this device.");
  const audio_url = await uploadAudioDataUrl(audioDataUrl, "chat-media", `${payload.conversation_id}/${payload.sender_id}/${crypto.randomUUID()}.webm`);
  const { audioDataKey, ...rest } = payload;
  return { ...rest, audio_url };
}

export async function syncOfflineQueue({ syncOnlyWifi = false, force = false } = {}) {
  if (!supabase || !navigator.onLine) return { synced: 0, failed: 0 };
  if (syncOnlyWifi && navigator.connection?.type !== "wifi" && !force) return { synced: 0, failed: 0, deferred: true };
  const queue = listQueuedItems();
  let synced = 0;
  let failed = 0;
  const remaining = [];

  for (const item of queue) {
    try {
      if (item.type === "report") {
        const payload = await uploadQueuedPhoto(item.payload, "price-proofs", "photo_url");
        const { error } = await supabase.from("reports").insert(payload);
        if (error) throw error;
      } else if (item.type === "seller_post") {
        const payload = await uploadQueuedPhoto(item.payload, "price-proofs", "photo_url");
        const { error } = await supabase.from("seller_posts").insert(payload);
        if (error) throw error;
      } else if (item.type === "message") {
        const payload = await uploadQueuedAudio(item.payload);
        const { error } = await supabase.from("messages").insert(payload);
        if (error) throw error;
      } else {
        throw new Error(`Unsupported queued item type: ${item.type}`);
      }
      if (item.payload.photoDataKey) await deleteOfflineMedia(item.payload.photoDataKey).catch((error) => console.warn("Could not remove synced photo from local storage:", error));
      if (item.payload.audioDataKey) await deleteOfflineMedia(item.payload.audioDataKey).catch((error) => console.warn("Could not remove synced audio from local storage:", error));
      synced += 1;
    } catch (error) {
      console.error(`Could not sync queued ${item.type}:`, error);
      failed += 1;
      remaining.push(item);
    }
  }

  saveQueue(remaining);
  if (synced) window.dispatchEvent(new CustomEvent("market-eye-toast", { detail: `${synced} pending item${synced === 1 ? "" : "s"} synced.` }));
  return { synced, failed };
}
