import { supabase } from "./supabase";

export async function compressImage(file) {
  const { default: imageCompression } = await import("browser-image-compression");
  return imageCompression(file, {
    maxSizeMB: 0.2,
    maxWidthOrHeight: 800,
    initialQuality: 0.7,
    useWebWorker: true,
  });
}

export function fileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the image."));
    reader.readAsDataURL(file);
  });
}

export async function uploadImage(file, bucket, path) {
  if (!supabase) throw new Error("Storage is unavailable.");
  const compressed = await compressImage(file);
  const { error } = await supabase.storage.from(bucket).upload(path, compressed, {
    upsert: true,
    contentType: compressed.type || "image/jpeg",
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadImageDataUrl(dataUrl, bucket, path) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return uploadImage(new File([blob], "proof.jpg", { type: blob.type || "image/jpeg" }), bucket, path);
}

export async function uploadAudioDataUrl(dataUrl, bucket, path) {
  if (!supabase) throw new Error("Storage is unavailable.");
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    upsert: false,
    contentType: blob.type || "audio/webm",
  });
  if (error) throw error;
  return path;
}
