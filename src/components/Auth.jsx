import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useSettings } from "../context/SettingsContext";

const inputClass = "w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3";

function getAuthErrorMessage(error, mode, t) {
  const detail = typeof error?.message === "string" ? error.message : "";
  const errorText = `${error?.code ?? ""} ${detail}`.toLowerCase();

  if (errorText.includes("already registered") || errorText.includes("user_already_exists")) {
    return t("auth.error.userExists");
  }
  if (errorText.includes("weak_password") || errorText.includes("password should")) {
    return t("auth.error.weakPassword");
  }
  if (errorText.includes("invalid email") || errorText.includes("email_address_invalid")) {
    return t("auth.error.invalidEmail");
  }
  if (
    errorText.includes("signup_disabled") ||
    errorText.includes("signups not allowed") ||
    errorText.includes("email_provider_disabled")
  ) {
    return t("auth.error.signupDisabled");
  }
  if (
    errorText.includes("rate limit") ||
    errorText.includes("rate_limit") ||
    errorText.includes("too many requests")
  ) {
    return t("auth.error.rateLimit");
  }
  if (errorText.includes("database error saving new user")) {
    return t("auth.error.profileSetup");
  }
  if (errorText.includes("email not confirmed") || errorText.includes("email_not_confirmed")) {
    return t("auth.error.emailNotConfirmed");
  }
  if (errorText.includes("invalid login credentials") || errorText.includes("invalid_credentials")) {
    return t("auth.error.credentials");
  }

  const message = detail || t("auth.error.unknown");
  return t(mode === "login" ? "auth.error.login" : "auth.error.signup", { detail: message });
}

export default function Auth({ goTo }) {
  const { t } = useSettings();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", role: "buyer", market: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!supabase) {
      setMessage(t("auth.unavailable"));
      setMessageType("error");
      return;
    }
    setBusy(true);
    setMessage("");
    setMessageType("");
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password });
        if (error) throw error;
        goTo("home");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { data: { name: form.name.trim(), phone: form.phone.trim(), role: form.role, market: form.market.trim() } },
      });
      if (error) throw error;
      if (!data.user) throw new Error("Account was not created.");

      setMessage(data.session ? t("auth.created") : t("auth.confirmEmail"));
      setMessageType("success");
      if (data.session) goTo("home");
    } catch (error) {
      console.error("Authentication request failed:", error);
      setMessage(getAuthErrorMessage(error, mode, t));
      setMessageType("error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
      <section className="rounded-3xl bg-white p-6 shadow-lg md:p-8">
        <h1 className="mb-2 text-3xl font-extrabold text-gray-900">{t(mode === "login" ? "auth.welcome" : "auth.createTitle")}</h1>
        <p className="mb-6 text-gray-500">{t("auth.subtitle")}</p>
        <div className="mb-5 flex gap-2">
          {["login", "signup"].map((item) => (
            <button key={item} type="button" onClick={() => { setMode(item); setMessage(""); setMessageType(""); }}
              className={`flex-1 rounded-xl px-4 py-2 font-bold capitalize ${mode === item ? "bg-brand text-white" : "bg-gray-100 text-gray-700"}`}>
              {t(item === "login" ? "auth.login" : "auth.signup")}
            </button>
          ))}
        </div>
        <form className="space-y-4" onSubmit={submit}>
          {mode === "signup" && <>
            <label className="block text-sm font-semibold">{t("auth.name")}<input className={inputClass} name="name" autoComplete="name" required value={form.name} onChange={change} /></label>
            <label className="block text-sm font-semibold">{t("auth.phone")}<input className={inputClass} name="phone" type="tel" autoComplete="tel" required value={form.phone} onChange={change} /></label>
            <label className="block text-sm font-semibold">{t("auth.accountType")}<select className={inputClass} name="role" value={form.role} onChange={change}><option value="buyer">{t("auth.buyer")}</option><option value="seller">{t("auth.seller")}</option></select></label>
            <label className="block text-sm font-semibold">{t("auth.market")}<input className={inputClass} name="market" required value={form.market} onChange={change} placeholder={t("auth.marketPlaceholder")} /></label>
          </>}
          <label className="block text-sm font-semibold">{t("auth.email")}<input className={inputClass} name="email" type="email" autoComplete="email" required value={form.email} onChange={change} /></label>
          <label className="block text-sm font-semibold">{t("auth.password")}<input className={inputClass} name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength="8" required value={form.password} onChange={change} /></label>
          {message && <p role={messageType === "error" ? "alert" : "status"} className={`rounded-xl p-3 text-sm ${messageType === "error" ? "bg-red-50 text-red-900" : "bg-emerald-50 text-emerald-900"}`}>{message}</p>}
          <button disabled={busy} className="w-full rounded-xl bg-brand px-4 py-3 font-bold text-white disabled:opacity-60">{busy ? t("auth.wait") : mode === "login" ? t("auth.login") : t("auth.createAccount")}</button>
        </form>
      </section>
    </main>
  );
}
