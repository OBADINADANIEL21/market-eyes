import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { fileAsDataUrl } from "../lib/uploads";
import { queueItem } from "../lib/offlineQueue";
import { readLocalCache, writeLocalCache } from "../lib/localCache";

export default function Chat({ chatId, goTo }) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [otherUser, setOtherUser] = useState(null);
  const [text, setText] = useState("");
  const [notice, setNotice] = useState("");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [call, setCall] = useState(null);
  const [incoming, setIncoming] = useState(false);
  const [callType, setCallType] = useState("voice");
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const bottomRef = useRef(null);

  const appendMessage = (message) => {
    setMessages((items) => {
      if (items.some((item) => item.id === message.id)) return items;
      const updated = [...items, message];
      const key = `market-eye-chat-${user.id}-${chatId}`;
      const cached = readLocalCache(key, {});
      writeLocalCache(key, {
        ...cached,
        conversation: conversation ?? cached.conversation,
        otherUser: otherUser ?? cached.otherUser,
        messages: updated,
      });
      return updated;
    });
  };

  const load = useCallback(async () => {
    const { data: convo, error: convoError } = await supabase.from("conversations").select("id,participant_one,participant_two,last_message").eq("id", chatId).maybeSingle();
    if (convoError || !convo || ![convo.participant_one, convo.participant_two].includes(user.id)) {
      console.error("Could not load authorized conversation:", convoError);
      const cached = readLocalCache(`market-eye-chat-${user.id}-${chatId}`);
      if (cached) {
        setConversation(cached.conversation);
        setOtherUser(cached.otherUser);
        setMessages(cached.messages ?? []);
        setNotice("Offline: showing messages saved on this device.");
        return;
      }
      setNotice("This conversation could not be opened.");
      return;
    }
    setConversation(convo);
    const otherId = convo.participant_one === user.id ? convo.participant_two : convo.participant_one;
    const [{ data: person, error: personError }, { data: rows, error: messagesError }] = await Promise.all([
      supabase.from("public_profiles").select("id,name,role,market").eq("id", otherId).maybeSingle(),
      supabase.from("messages").select("id,conversation_id,sender_id,receiver_id,message,message_type,audio_url,audio_size_bytes,is_read,created_at").eq("conversation_id", chatId).order("created_at", { ascending: true }).limit(200),
    ]);
    if (personError || messagesError) {
      console.error("Could not load chat messages:", personError ?? messagesError);
      setNotice("Could not load messages. Please try again.");
      return;
    }
    setOtherUser(person);
    const audioRows = await Promise.all((rows ?? []).map(async (message) => {
      if (message.message_type !== "voice" || !message.audio_url || message.audio_url.startsWith("http")) return message;
      const { data: signed, error: signError } = await supabase.storage.from("chat-media").createSignedUrl(message.audio_url, 3600);
      if (signError) {
        console.warn("Could not sign voice-note URL:", signError);
        return message;
      }
      return { ...message, audio_url: signed.signedUrl };
    }));
    setMessages(audioRows);
    writeLocalCache(`market-eye-chat-${user.id}-${chatId}`, { conversation: convo, otherUser: person, messages: audioRows });
    const { error: readError } = await supabase.from("messages").update({ is_read: true, read_at: new Date().toISOString() }).eq("conversation_id", chatId).eq("receiver_id", user.id).eq("is_read", false);
    if (readError) console.warn("Could not mark messages read:", readError);
  }, [chatId, user.id]);

  useEffect(() => {
    void load();
    const channel = supabase.channel(`chat-${chatId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${chatId}` }, async (event) => {
        let nextMessage = event.new;
        if (nextMessage.message_type === "voice" && nextMessage.audio_url && !nextMessage.audio_url.startsWith("http")) {
          const { data: signed, error } = await supabase.storage.from("chat-media").createSignedUrl(nextMessage.audio_url, 3600);
          if (!error) nextMessage = { ...nextMessage, audio_url: signed.signedUrl };
        }
        appendMessage(nextMessage);
        if (event.new.receiver_id === user.id) void supabase.from("messages").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", event.new.id);
      })
      .subscribe();
    const callChannel = supabase.channel(`incoming-call-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "calls", filter: `receiver_id=eq.${user.id}` }, (event) => {
        if (event.new.status === "ringing" && event.new.conversation_id === chatId) {
          setCall(event.new);
          setIncoming(true);
        }
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); void supabase.removeChannel(callChannel); };
  }, [load, chatId, user.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!incoming || !call) return undefined;
    const timeout = window.setTimeout(async () => {
      const { error } = await supabase.rpc("update_call_status", { p_call_id: call.id, p_status: "missed" });
      if (error) console.warn("Could not mark unanswered call:", error);
      setCall(null);
      setIncoming(false);
    }, 30_000);
    return () => window.clearTimeout(timeout);
  }, [incoming, call]);

  useEffect(() => {
    if (!call?.id) return undefined;
    const channel = supabase.channel(`call-status-${call.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "calls", filter: `id=eq.${call.id}` }, (event) => {
        if (["ended", "missed", "declined"].includes(event.new.status)) setCall(null);
        else setCall(event.new);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [call?.id]);

  useEffect(() => {
    const callId = new URLSearchParams(window.location.search).get("callId");
    if (!callId || !conversation) return;
    let active = true;
    supabase.from("calls").select("id,conversation_id,caller_id,receiver_id,call_type,status,created_at")
      .eq("id", callId).eq("conversation_id", chatId).eq("receiver_id", user.id).eq("status", "ringing").maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error("Could not load notification call:", error);
        if (active && data) { setCall(data); setIncoming(true); }
      });
    return () => { active = false; };
  }, [chatId, conversation, user.id]);

  useEffect(() => {
    const refreshCachedConversation = () => {
      if (navigator.onLine) void load();
    };
    window.addEventListener("market-eye-queue-change", refreshCachedConversation);
    return () => window.removeEventListener("market-eye-queue-change", refreshCachedConversation);
  }, [load]);

  useEffect(() => {
    if (!incoming) return undefined;
    const vibration = window.setInterval(() => navigator.vibrate?.([300, 150, 300]), 1000);
    let context;
    let oscillator;
    try {
      context = new AudioContext();
      oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 660;
      gain.gain.value = 0.035;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
    } catch (error) {
      console.info("The browser did not allow an in-app ringtone:", error);
    }
    return () => {
      window.clearInterval(vibration);
      navigator.vibrate?.(0);
      oscillator?.stop();
      void context?.close();
    };
  }, [incoming]);

  const sendMessage = async (payload) => {
    if (!conversation || !otherUser) return;
    if (!navigator.onLine) {
      const queued = await queueItem("message", payload);
      appendMessage({ ...payload, id: queued.id, created_at: queued.createdAt, sync_status: "pending" });
      return;
    }
    const { data, error } = await supabase.from("messages").insert(payload).select("id,conversation_id,sender_id,receiver_id,message,message_type,audio_url,audio_size_bytes,is_read,created_at").single();
    if (error) throw error;
    let displayMessage = data;
    if (data.message_type === "voice" && data.audio_url && !data.audio_url.startsWith("http")) {
      const { data: signed, error: signError } = await supabase.storage.from("chat-media").createSignedUrl(data.audio_url, 3600);
      if (signError) console.warn("Could not create voice-note playback link:", signError);
      else displayMessage = { ...data, audio_url: signed.signedUrl };
    }
    appendMessage(displayMessage);
    const { error: convoError } = await supabase.from("conversations").update({ last_message: payload.message, last_message_at: new Date().toISOString() }).eq("id", chatId);
    if (convoError) console.warn("Could not update conversation preview:", convoError);
    const { error: pushError } = await supabase.functions.invoke("send-push", {
      body: { type: "message", messageId: data.id },
    });
    if (pushError) console.warn("Message saved; notification could not be sent:", pushError);
  };

  const submitText = async (event) => {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText("");
    try {
      await sendMessage({ conversation_id: chatId, sender_id: user.id, receiver_id: otherUser.id, message: value, message_type: "text" });
    } catch (error) {
      console.error("Could not send message:", error);
      setText(value);
      setNotice("Message could not be sent. Please retry.");
    }
  };

  const startRecording = async (event) => {
    event.preventDefault();
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setNotice("Voice recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { audioBitsPerSecond: profile?.data_saver ? 32_000 : 128_000 });
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = async () => {
        clearInterval(timerRef.current);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size && recorder.sendWhenStopped) {
          try {
            if (!navigator.onLine) {
              const audioDataUrl = await fileAsDataUrl(new File([blob], "voice-note.webm", { type: blob.type }));
              const payload = { conversation_id: chatId, sender_id: user.id, receiver_id: otherUser.id, message: "🎤 Voice Note", message_type: "voice", audio_url: null, audio_size_bytes: blob.size, audioDataUrl };
              const queued = await queueItem("message", payload);
              appendMessage({ ...payload, id: queued.id, audio_url: null, created_at: queued.createdAt, sync_status: "pending" });
            } else {
              const path = `${chatId}/${user.id}/${crypto.randomUUID()}.webm`;
              const { error: uploadError } = await supabase.storage.from("chat-media").upload(path, blob, { contentType: blob.type, upsert: false });
              if (uploadError) throw uploadError;
              await sendMessage({ conversation_id: chatId, sender_id: user.id, receiver_id: otherUser.id, message: "🎤 Voice Note", message_type: "voice", audio_url: path, audio_size_bytes: blob.size });
            }
          } catch (error) {
            console.error("Could not send voice note:", error);
            setNotice("Voice note could not be sent.");
          }
        }
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setRecording(false);
      };
      recorder.start();
      setSeconds(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => setSeconds((value) => {
        if (value >= 59) {
          if (recorderRef.current?.state === "recording") {
            recorderRef.current.sendWhenStopped = true;
            recorderRef.current.stop();
          }
          return 60;
        }
        return value + 1;
      }), 1000);
    } catch (error) {
      console.error("Could not start voice recording:", error);
      setNotice("Microphone access was not available.");
    }
  };

  const stopRecording = (send) => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.sendWhenStopped = send;
    recorder.stop();
  };

  const createCall = async (type) => {
    if (!conversation || !otherUser) return;
    if (type === "video" && ["slow-2g", "2g"].includes(navigator.connection?.effectiveType)) {
      setNotice("Video calling is disabled on this slow connection.");
      return;
    }
    setNotice("");
    setCallType(type);
    try {
      const { data, error } = await supabase.from("calls").insert({
        conversation_id: chatId, caller_id: user.id, receiver_id: otherUser.id, call_type: type, status: "ringing",
      }).select("id,conversation_id,caller_id,receiver_id,call_type,status,created_at").single();
      if (error) throw error;
      setCall(data);
      const { error: pushError } = await supabase.functions.invoke("send-push", {
        body: { type: "call", callId: data.id },
      });
      if (pushError) console.warn("Call started; push notification could not be sent:", pushError);
    } catch (error) {
      console.error("Could not start call:", error);
      setNotice("Could not start this call. Check camera/microphone permission and try again.");
    }
  };

  const answerCall = async (accept) => {
    if (!call) return;
    const { error } = await supabase.rpc("update_call_status", { p_call_id: call.id, p_status: accept ? "ongoing" : "declined" });
    if (error) {
      console.error("Could not answer call:", error);
      setNotice("Could not update the call. Try again.");
      return;
    }
    setIncoming(false);
    if (accept) setCall((current) => ({ ...current, status: "ongoing" }));
    else setCall(null);
  };

  const endCall = async () => {
    if (!call) return;
    const { error } = await supabase.rpc("update_call_status", { p_call_id: call.id, p_status: call.status === "ringing" ? "cancelled" : "ended" });
    if (error) console.error("Could not end call:", error);
    setCall(null);
  };

  return <div className="mx-auto flex h-[calc(100dvh-10rem)] max-w-3xl flex-col px-3 py-4">
    <header className="flex items-center gap-3 rounded-t-2xl bg-white p-4 shadow">
      <button onClick={() => goTo("messages")} aria-label="Back to messages" className="text-xl">←</button>
      <div className="min-w-0 flex-1"><div className="truncate font-bold">{otherUser?.name ?? "Conversation"}</div><div className="text-xs text-gray-500">{otherUser?.market} · {otherUser?.role}</div></div>
      <button onClick={() => void createCall("voice")} aria-label="Voice call" className="rounded-full p-2 text-xl">📞</button>
      <button onClick={() => void createCall("video")} aria-label="Video call" className="rounded-full p-2 text-xl">📹</button>
    </header>
    {notice && <p role="status" className="bg-amber-50 p-2 text-sm text-amber-900">{notice}</p>}
    <div className="flex-1 space-y-3 overflow-y-auto bg-[#e8f5ee] p-4">
      {messages.map((message) => {
        const own = message.sender_id === user.id;
        return <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
          <div className={`max-w-[85%] rounded-2xl px-4 py-2 shadow-sm ${own ? "rounded-br-sm bg-[#d9fdd3]" : "rounded-bl-sm bg-white"}`}>
            {message.message_type === "voice" && message.audio_url ? <VoiceNote message={message} autoDownload={Boolean(profile?.auto_download_vn)} /> : <p className="whitespace-pre-wrap break-words">{message.message}</p>}
            <div className="mt-1 flex justify-end gap-1 text-[10px] text-gray-500">{message.sync_status === "pending" ? "⏳ Waiting" : new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{own && message.is_read && <span className="text-blue-600">✓✓</span>}</div>
          </div>
        </div>;
      })}
      <div ref={bottomRef} />
    </div>
    <form onSubmit={submitText} className="flex items-end gap-2 rounded-b-2xl bg-white p-3 shadow">
      <button type="button" aria-label={recording ? "Release to send voice note" : "Hold to record voice note"} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); void startRecording(event); }} onPointerUp={() => stopRecording(true)} onPointerCancel={() => stopRecording(false)} onContextMenu={(event) => event.preventDefault()} className={`min-h-12 min-w-12 rounded-full text-xl ${recording ? "bg-red-100 text-red-700" : "bg-gray-100"}`}>{recording ? `● ${seconds}s` : "🎙️"}</button>
      {recording && <button type="button" onClick={() => stopRecording(false)} className="rounded-xl border px-3 py-2 text-sm font-semibold">Cancel</button>}
      <input value={text} onChange={(event) => setText(event.target.value)} className="min-w-0 flex-1 rounded-full border bg-gray-50 px-4 py-3" placeholder="Type a message" aria-label="Message" />
      <button className="rounded-full bg-brand px-5 py-3 font-bold text-white">Send</button>
    </form>
    {call && <CallOverlay call={call} currentUserId={user.id} incoming={incoming} otherUser={otherUser} callType={call.call_type || callType} onAccept={() => void answerCall(true)} onDecline={() => void answerCall(false)} onEnd={() => void endCall()} />}
  </div>;
}

function VoiceNote({ message, autoDownload }) {
  const [unlocked, setUnlocked] = useState(autoDownload);
  const size = message.audio_size_bytes
    ? message.audio_size_bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(message.audio_size_bytes / 1024))}KB`
      : `${(message.audio_size_bytes / (1024 * 1024)).toFixed(1)}MB`
    : "voice note";
  if (!unlocked) return <button onClick={() => setUnlocked(true)} className="rounded-full bg-emerald-50 px-3 py-2 text-sm font-semibold text-brand">Tap to download · {size}</button>;
  return <audio controls preload="none" src={message.audio_url} className="max-w-full" />;
}

function CallOverlay({ call, currentUserId, incoming, otherUser, callType, onAccept, onDecline, onEnd }) {
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const remoteAudio = useRef(null);
  const localStreamRef = useRef(null);
  const peerRef = useRef(null);
  const [callStatus, setCallStatus] = useState(incoming ? "Incoming call" : "Calling…");
  const [muted, setMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(callType === "video");
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [cameraFacing, setCameraFacing] = useState("user");

  useEffect(() => {
    if (incoming || call.status !== "ongoing") return undefined;
    let active = true;
    let peer;
    let channel;
    let localStream;
    const remoteCandidates = [];
    const start = async () => {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true },
          video: callType === "video" ? { width: { ideal: 426 }, height: { ideal: 240 }, frameRate: { ideal: 15 }, facingMode: cameraFacing } : false,
        });
        if (!active) { localStream.getTracks().forEach((track) => track.stop()); return; }
        localStreamRef.current = localStream;
        if (localVideo.current) localVideo.current.srcObject = localStream;
        peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
        peerRef.current = peer;
        localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));
        peer.ontrack = (event) => {
          if (remoteVideo.current) remoteVideo.current.srcObject = event.streams[0];
          if (remoteAudio.current) remoteAudio.current.srcObject = event.streams[0];
        };
        peer.onicecandidate = (event) => {
          if (event.candidate) void channel.send({ type: "broadcast", event: "candidate", payload: event.candidate.toJSON() });
        };
        peer.onconnectionstatechange = () => setCallStatus(peer.connectionState === "connected" ? "Connected" : peer.connectionState);
        channel = supabase.channel(`call-${call.id}`, { config: { broadcast: { self: false } } });
        let offerSent = false;
        const sendOffer = async () => {
          if (offerSent) return;
          offerSent = true;
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          await channel.send({ type: "broadcast", event: "offer", payload: offer });
          setCallStatus("Ringing…");
        };
        channel.on("broadcast", { event: "ready" }, async () => {
          if (call.caller_id === currentUserId) await sendOffer();
        });
        channel.on("broadcast", { event: "hello" }, async () => {
          if (call.caller_id !== currentUserId) await channel.send({ type: "broadcast", event: "ready", payload: {} });
        });
        channel.on("broadcast", { event: "offer" }, async ({ payload }) => {
          if (call.caller_id === currentUserId) return;
          await peer.setRemoteDescription(payload);
          for (const candidate of remoteCandidates.splice(0)) await peer.addIceCandidate(candidate);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          await channel.send({ type: "broadcast", event: "answer", payload: answer });
          setCallStatus("Connecting…");
        });
        channel.on("broadcast", { event: "answer" }, async ({ payload }) => {
          if (call.caller_id !== currentUserId) return;
          await peer.setRemoteDescription(payload);
          for (const candidate of remoteCandidates.splice(0)) await peer.addIceCandidate(candidate);
        });
        channel.on("broadcast", { event: "candidate" }, async ({ payload }) => {
          if (peer.remoteDescription) await peer.addIceCandidate(payload);
          else remoteCandidates.push(payload);
        });
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("Signaling timed out.")), 10_000);
          channel.subscribe((status) => {
            if (status === "SUBSCRIBED") { clearTimeout(timeout); resolve(); }
            if (status === "CHANNEL_ERROR") { clearTimeout(timeout); reject(new Error("Signaling channel failed.")); }
          });
        });
        if (call.caller_id === currentUserId) {
          setCallStatus("Waiting for the other device…");
          await channel.send({ type: "broadcast", event: "hello", payload: {} });
        } else {
          setCallStatus("Waiting for caller…");
          await channel.send({ type: "broadcast", event: "ready", payload: {} });
        }
      } catch (error) {
        console.error("WebRTC call setup failed:", error);
        setCallStatus("Call could not connect. A TURN relay may be needed on this network.");
      }
    };
    void start();
    return () => {
      active = false;
      if (peer) peer.close();
      if (channel) void supabase.removeChannel(channel);
      localStream?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      peerRef.current = null;
    };
  }, [call, callType, currentUserId, incoming]);

  const switchCamera = async () => {
    const nextFacing = cameraFacing === "user" ? "environment" : "user";
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: nextFacing }, audio: false });
      const nextTrack = cameraStream.getVideoTracks()[0];
      const sender = peerRef.current?.getSenders().find((item) => item.track?.kind === "video");
      if (!sender || !nextTrack) throw new Error("No active camera track.");
      await sender.replaceTrack(nextTrack);
      const stream = localStreamRef.current;
      stream?.getVideoTracks().forEach((track) => { stream.removeTrack(track); track.stop(); });
      stream?.addTrack(nextTrack);
      if (localVideo.current) localVideo.current.srcObject = stream;
      setCameraFacing(nextFacing);
    } catch (error) {
      console.error("Could not switch camera:", error);
    }
  };

  return <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/95 p-4 text-white">
    <div className="w-full max-w-lg text-center">
      <h2 className="mb-2 text-2xl font-bold">{callType === "video" ? "Video call" : "Voice call"} · {otherUser?.name}</h2>
      <p className="mb-5 text-sm text-gray-300">{incoming ? "Incoming call" : callStatus}</p>
      <audio ref={remoteAudio} autoPlay muted={!speakerEnabled || callType === "video"} />
      {callType === "video" && <div className="relative mb-5 aspect-video overflow-hidden rounded-2xl bg-black"><video ref={remoteVideo} autoPlay playsInline className="h-full w-full object-cover" /><video ref={localVideo} autoPlay muted playsInline className="absolute bottom-3 right-3 h-24 w-32 rounded-xl object-cover" /></div>}
      {!incoming && <p className="mb-3 text-xs text-gray-400">Estimated data use: about 0.5 MB/min for voice; video varies by network.</p>}
      {incoming ? <div className="flex justify-center gap-5"><button onClick={onDecline} className="rounded-full bg-red-600 px-6 py-4 font-bold">Decline</button><button onClick={onAccept} className="rounded-full bg-green-600 px-6 py-4 font-bold">Accept</button></div> : <div className="flex flex-wrap justify-center gap-3"><button onClick={() => setMuted((value) => { localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = value; }); return !value; })} className="rounded-full bg-slate-700 px-5 py-3">{muted ? "Unmute" : "Mute"}</button><button onClick={() => setSpeakerEnabled((value) => { const next = !value; if (remoteVideo.current) remoteVideo.current.muted = !next; return next; })} className="rounded-full bg-slate-700 px-5 py-3">{speakerEnabled ? "Speaker on" : "Speaker off"}</button>{callType === "video" && <><button onClick={() => setVideoEnabled((value) => { localStreamRef.current?.getVideoTracks().forEach((track) => { track.enabled = !value; }); return !value; })} className="rounded-full bg-slate-700 px-5 py-3">{videoEnabled ? "Video off" : "Video on"}</button><button onClick={() => void switchCamera()} className="rounded-full bg-slate-700 px-5 py-3">Switch camera</button></>}<button onClick={onEnd} className="rounded-full bg-red-600 px-6 py-3 font-bold">End call</button></div>}
    </div>
  </div>;
}
