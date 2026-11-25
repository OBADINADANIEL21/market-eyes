import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { readLocalCache, writeLocalCache } from "../lib/localCache";

export default function Messages({ goTo }) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [unread, setUnread] = useState({});
  const [missed, setMissed] = useState({});
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const [peopleResult, convoResult] = await Promise.all([
      supabase.from("public_profiles").select("id,name,role,market,last_seen").neq("id", user.id).order("name").limit(100),
      supabase.from("conversations").select("id,participant_one,participant_two,last_message,last_message_at").or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`).order("last_message_at", { ascending: false }),
    ]);
    const error = peopleResult.error ?? convoResult.error;
    if (error) {
      console.error("Could not load messages:", error);
      const cached = readLocalCache(`market-eye-messages-list-${user.id}`);
      if (cached) {
        setProfiles(cached.profiles ?? []);
        setConversations(cached.conversations ?? []);
        setNotice("Offline: showing previously saved people and conversations.");
      } else setNotice("Could not load the people list. Please try again.");
      return;
    }
    const chats = convoResult.data ?? [];
    setProfiles(peopleResult.data ?? []);
    setConversations(chats);
    writeLocalCache(`market-eye-messages-list-${user.id}`, { profiles: peopleResult.data ?? [], conversations: chats });
    if (chats.length) {
      const ids = chats.map((chat) => chat.id);
      const [unreadResult, missedResult] = await Promise.all([
        supabase.from("messages").select("conversation_id").in("conversation_id", ids).eq("receiver_id", user.id).eq("is_read", false).limit(500),
        supabase.from("calls").select("conversation_id").in("conversation_id", ids).eq("receiver_id", user.id).eq("status", "missed").limit(100),
      ]);
      if (unreadResult.error || missedResult.error) console.warn("Could not load message badges:", unreadResult.error ?? missedResult.error);
      setUnread((unreadResult.data ?? []).reduce((result, row) => ({ ...result, [row.conversation_id]: (result[row.conversation_id] ?? 0) + 1 }), {}));
      setMissed((missedResult.data ?? []).reduce((result, row) => ({ ...result, [row.conversation_id]: (result[row.conversation_id] ?? 0) + 1 }), {}));
    }
  }, [user.id]);

  useEffect(() => {
    void load();
    const channel = supabase.channel(`message-list-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "calls" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, user.id]);

  const filtered = useMemo(() => profiles.filter((person) => `${person.name} ${person.market} ${person.role}`.toLowerCase().includes(query.toLowerCase())), [profiles, query]);
  const openConversation = async (person) => {
    const a = user.id < person.id ? user.id : person.id;
    const b = user.id < person.id ? person.id : user.id;
    const existing = conversations.find((chat) => chat.participant_one === a && chat.participant_two === b);
    if (existing) {
      goTo("chat", { chatId: existing.id });
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("get_or_create_conversation", { p_other_user: person.id });
      if (error) throw error;
      goTo("chat", { chatId: typeof data === "string" ? data : data?.id });
    } catch (error) {
      console.error("Could not open conversation:", error);
      setNotice("Could not start this chat. Please try again.");
    } finally { setBusy(false); }
  };

  return <div className="mx-auto max-w-3xl px-4 py-8">
    <h1 className="text-3xl font-extrabold">Messages</h1>
    <input className="my-5 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3" aria-label="Search people" placeholder="Search by name or market" value={query} onChange={(event) => setQuery(event.target.value)} />
    {notice && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-red-800">{notice}</p>}
    {filtered.length ? <ul className="divide-y overflow-hidden rounded-2xl bg-white shadow">{filtered.map((person) => {
      const a = user.id < person.id ? user.id : person.id;
      const b = user.id < person.id ? person.id : user.id;
      const chat = conversations.find((row) => row.participant_one === a && row.participant_two === b);
      const isOnline = person.last_seen && Date.now() - new Date(person.last_seen).getTime() < 120_000;
      return <li key={person.id}><button disabled={busy} onClick={() => void openConversation(person)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-emerald-50">
        <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-emerald-100 text-lg font-bold text-brand">{person.name?.[0]?.toUpperCase() ?? "?"}<span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${isOnline ? "bg-green-500" : "bg-gray-300"}`} /></span>
        <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2 font-bold">{person.name || "MARKET EYE user"}<span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs capitalize">{person.role}</span></span><span className="block truncate text-xs text-gray-500">{person.market || "Market not set"} · {chat?.last_message || (isOnline ? "Online now" : "Start a conversation")}</span></span>
        {chat && (unread[chat.id] > 0 || missed[chat.id] > 0) && <span className="flex gap-1">{unread[chat.id] > 0 && <span className="rounded-full bg-brand px-2 py-1 text-xs font-bold text-white">{unread[chat.id]}</span>}{missed[chat.id] > 0 && <span className="rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white">☎ {missed[chat.id]}</span>}</span>}
      </button></li>;
    })}</ul> : <p className="rounded-xl bg-white p-5 text-gray-600">No matching users yet.</p>}
  </div>;
}
