import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  const authorization = request.headers.get("Authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const oneSignalAppId = Deno.env.get("ONESIGNAL_APP_ID");
  const oneSignalApiKey = Deno.env.get("ONESIGNAL_API_KEY");
  const publicSiteUrl = Deno.env.get("PUBLIC_SITE_URL")?.replace(/\/+$/, "");

  if (!token || !supabaseUrl || !anonKey || !serviceRoleKey || !oneSignalAppId || !oneSignalApiKey || !publicSiteUrl) {
    return Response.json({ error: "Notification service is not configured." }, { status: 503, headers: corsHeaders });
  }

  const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: userData, error: authError } = await authClient.auth.getUser();
  if (authError || !userData.user) return Response.json({ error: "Authentication required." }, { status: 401, headers: corsHeaders });

  let payload: { type?: string; messageId?: string; callId?: string };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400, headers: corsHeaders });
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let receiverId: string;
  let title: string;
  let body: string;
  let data: Record<string, string>;
  let conversationId: string;

  if (payload.type === "message" && payload.messageId) {
    const { data: message, error } = await admin.from("messages")
      .select("id,sender_id,receiver_id,message,message_type,conversation_id")
      .eq("id", payload.messageId)
      .maybeSingle();
    if (error || !message || message.sender_id !== userData.user.id) {
      return Response.json({ error: "Message not found." }, { status: 404, headers: corsHeaders });
    }
    const { data: sender } = await admin.from("profiles").select("name").eq("id", message.sender_id).maybeSingle();
    receiverId = message.receiver_id;
    conversationId = message.conversation_id;
    title = `New message from ${sender?.name || "MARKET EYE user"}`;
    body = message.message_type === "voice" ? "🎤 Voice Note" : message.message.slice(0, 120);
    data = { type: "message", conversation_id: conversationId, url: `/chat/${conversationId}` };
  } else if (payload.type === "call" && payload.callId) {
    const { data: call, error } = await admin.from("calls")
      .select("id,caller_id,receiver_id,conversation_id,call_type,status")
      .eq("id", payload.callId)
      .maybeSingle();
    if (error || !call || call.caller_id !== userData.user.id || call.status !== "ringing") {
      return Response.json({ error: "Call not found." }, { status: 404, headers: corsHeaders });
    }
    const { data: caller } = await admin.from("profiles").select("name").eq("id", call.caller_id).maybeSingle();
    receiverId = call.receiver_id;
    conversationId = call.conversation_id;
    const callLabel = call.call_type === "video" ? "Video" : "Voice";
    title = `${caller?.name || "MARKET EYE user"} is calling you`;
    body = `${callLabel} call · Tap to open MARKET EYE`;
    data = { type: "call", call_id: call.id, conversation_id: conversationId, call_type: call.call_type, url: `/chat/${conversationId}?callId=${call.id}` };
  } else {
    return Response.json({ error: "Invalid notification event." }, { status: 400, headers: corsHeaders });
  }

  const { data: recipient, error: profileError } = await admin.from("profiles")
    .select("last_seen,notify_message,notify_call,do_not_disturb,timezone")
    .eq("id", receiverId)
    .maybeSingle();
  if (profileError || !recipient) return Response.json({ error: "Recipient unavailable." }, { status: 404, headers: corsHeaders });
  const enabled = payload.type === "message" ? recipient.notify_message : recipient.notify_call;
  const recentlySeen = recipient.last_seen && Date.now() - new Date(recipient.last_seen).getTime() < 120_000;
  let localHour = new Date().getUTCHours();
  try {
    localHour = Number(new Intl.DateTimeFormat("en-US", {
      timeZone: recipient.timezone || "UTC",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()));
  } catch (error) {
    console.warn("Invalid profile timezone; using UTC for quiet hours:", error);
  }
  const quietHours = localHour >= 22 || localHour < 6;
  if (!enabled || recentlySeen || (recipient.do_not_disturb && quietHours)) {
    return Response.json({ skipped: true }, { headers: corsHeaders });
  }

  const response = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${oneSignalApiKey}`,
    },
    body: JSON.stringify({
      app_id: oneSignalAppId,
      target_channel: "push",
      include_aliases: { external_id: [receiverId] },
      headings: { en: title },
      contents: { en: body },
      data,
      url: `${publicSiteUrl}${data.url}`,
      priority: 10,
      ttl: payload.type === "call" ? 30 : 3600,
    }),
  });
  const result = await response.json();
  if (!response.ok) {
    console.error("OneSignal API rejected notification:", result);
    return Response.json({ error: "Notification could not be delivered." }, { status: 502, headers: corsHeaders });
  }
  return Response.json({ sent: true }, { headers: corsHeaders });
});
