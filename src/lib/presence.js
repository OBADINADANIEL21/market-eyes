const ONLINE_WINDOW_MS = 2 * 60_000;

export function isUserOnline(lastSeen, now = Date.now()) {
  const timestamp = new Date(lastSeen ?? "").getTime();
  const age = now - timestamp;
  return Number.isFinite(timestamp) && age >= -ONLINE_WINDOW_MS && age < ONLINE_WINDOW_MS;
}

export function getPresenceText(lastSeen, now = Date.now()) {
  const timestamp = new Date(lastSeen ?? "").getTime();
  if (!Number.isFinite(timestamp)) return "Last seen unavailable";
  if (isUserOnline(lastSeen, now)) return "Online";

  const date = new Date(timestamp);
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (timestamp >= today.getTime()) return `Last seen today at ${time}`;
  if (timestamp >= yesterday.getTime()) return `Last seen yesterday at ${time}`;
  return `Last seen ${date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })} at ${time}`;
}
