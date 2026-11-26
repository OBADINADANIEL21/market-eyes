import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { normalizeHttpsUrl, normalizeNigerianWhatsApp } from "../lib/whatsapp";

const inputClass = "w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3";

function getAuthErrorMessage(error, mode, t) {
  const detail = typeof error?.message === "string" ? error.message : "";
  const errorText = `${error?.code ?? ""} ${error?.status ?? ""} ${detail}`.toLowerCase();

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
    errorText.includes("too many requests") ||
    errorText.includes("too many attempts") ||
    errorText.includes("too_many_attempts") ||
    error?.status === 429
  ) {
    return t("auth.error.rateLimit");
  }
  if (
    errorText.includes("failed to fetch") ||
    errorText.includes("fetch failed") ||
    errorText.includes("networkerror") ||
    errorText.includes("network error")
  ) {
    return t("auth.error.network");
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
  const errorKey = mode === "login" ? "auth.error.login"
    : mode === "signup" ? "auth.error.signup"
    : mode === "forgot" ? "auth.error.reset"
    : "auth.error.update";
  return t(errorKey, { detail: message });
}

export default function Auth({ goTo, authMode }) {
  const { loading: authLoading } = useAuth();
  const { t } = useSettings();
  const [mode, setMode] = useState(authMode ?? "login");
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", phone: "", role: "buyer", market: "", storeName: "", whatsappNumber: "", groupLink: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  useEffect(() => {
    if (authMode) setMode(authMode);
  }, [authMode]);

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
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(form.email.trim(), {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setMessage(t("auth.resetSent"));
        setMessageType("success");
        return;
      }

      if (mode === "update") {
        if (form.password !== form.confirmPassword) {
          setMessage(t("auth.passwordMismatch"));
          setMessageType("error");
          return;
        }
        const { error } = await supabase.auth.updateUser({ password: form.password });
        if (error) throw error;
        window.history.replaceState({}, "", window.location.pathname);
        goTo("home");
        return;
      }

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password });
        if (error) throw error;
        goTo("home");
        return;
      }

      const storeName = form.storeName.trim();
      const whatsappNumber = normalizeNigerianWhatsApp(form.whatsappNumber);
      const groupLink = normalizeHttpsUrl(form.groupLink);
      if (form.role === "seller" && !storeName) {
        setMessage("Enter your store name.");
        setMessageType("error");
        return;
      }
      if (form.role === "seller" && !whatsappNumber) {
        setMessage("Enter a WhatsApp number beginning with +234 and followed by 10 digits.");
        setMessageType("error");
        return;
      }
      if (groupLink === null) {
        setMessage("Enter a secure group link beginning with https://.");
        setMessageType("error");
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: {
            name: form.name.trim(),
            phone: form.phone.trim(),
            role: form.role,
            market: form.market.trim(),
            store_name: form.role === "seller" ? storeName : "",
            whatsapp_number: form.role === "seller" ? whatsappNumber : "",
            group_link: form.role === "seller" ? groupLink : "",
          },
        },
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
        <h1 className="mb-2 text-3xl font-extrabold text-gray-900">{t(
          mode === "login" ? "auth.welcome" :
          mode === "signup" ? "auth.createTitle" :
          mode === "forgot" ? "auth.resetTitle" : "auth.updateTitle"
        )}</h1>
        <p className="mb-6 text-gray-500">{t(
          mode === "forgot" ? "auth.resetSubtitle" :
          mode === "update" ? "auth.updateSubtitle" : "auth.subtitle"
        )}</p>
        {(mode === "login" || mode === "signup") ? (
          <div className="mb-5 flex gap-2">
            {["login", "signup"].map((item) => (
              <button key={item} type="button" onClick={() => { setMode(item); setMessage(""); setMessageType(""); }}
                className={`flex-1 rounded-xl px-4 py-2 font-bold capitalize ${mode === item ? "bg-brand text-white" : "bg-gray-100 text-gray-700"}`}>
                {t(item === "login" ? "auth.login" : "auth.signup")}
              </button>
            ))}
          </div>
        ) : (
          <button type="button" onClick={() => { setMode("login"); setMessage(""); setMessageType(""); }}
            className="mb-5 rounded-xl border px-4 py-2 font-semibold">{t("auth.backToLogin")}</button>
        )}
        <form className="space-y-4" onSubmit={submit}>
          {mode === "signup" && <>
            <label className="block text-sm font-semibold">{t("auth.name")}<input className={inputClass} name="name" autoComplete="name" required value={form.name} onChange={change} /></label>
            <label className="block text-sm font-semibold">{t("auth.phone")}<input className={inputClass} name="phone" type="tel" autoComplete="tel" required value={form.phone} onChange={change} /></label>
            <label className="block text-sm font-semibold">{t("auth.accountType")}<select className={inputClass} name="role" value={form.role} onChange={change}><option value="buyer">{t("auth.buyer")}</option><option value="seller">{t("auth.seller")}</option></select></label>
            <label className="block text-sm font-semibold">{t("auth.market")}<input className={inputClass} name="market" required value={form.market} onChange={change} placeholder={t("auth.marketPlaceholder")} /></label>
            {form.role === "seller" && <>
              <label className="block text-sm font-semibold">Store name<input className={inputClass} name="storeName" required autoComplete="organization" value={form.storeName} onChange={change} placeholder="e.g. Mama Nkechi Stores" /></label>
              <label className="block text-sm font-semibold">WhatsApp number<input className={inputClass} name="whatsappNumber" type="tel" required value={form.whatsappNumber} onChange={change} placeholder="+234 801 234 5678" /></label>
              <label className="block text-sm font-semibold">WhatsApp group link (optional)<input className={inputClass} name="groupLink" type="url" value={form.groupLink} onChange={change} placeholder="https://chat.whatsapp.com/..." /></label>
            </>}
          </>}
          {(mode !== "update") && <label className="block text-sm font-semibold">{t("auth.email")}<input className={inputClass} name="email" type="email" autoComplete="email" required value={form.email} onChange={change} /></label>}
          {(mode === "login" || mode === "signup" || mode === "update") && <label className="block text-sm font-semibold">{t("auth.password")}<input className={inputClass} name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength="8" required value={form.password} onChange={change} /></label>}
          {mode === "update" && <label className="block text-sm font-semibold">{t("auth.confirmPassword")}<input className={inputClass} name="confirmPassword" type="password" autoComplete="new-password" minLength="8" required value={form.confirmPassword} onChange={change} /></label>}
          {mode === "login" && <button type="button" onClick={() => { setMode("forgot"); setMessage(""); setMessageType(""); }} className="text-sm font-bold text-brand underline">{t("auth.forgotPassword")}</button>}
          {message && <p role={messageType === "error" ? "alert" : "status"} className={`rounded-xl p-3 text-sm ${messageType === "error" ? "bg-red-50 text-red-900" : "bg-emerald-50 text-emerald-900"}`}>{message}</p>}
          <button disabled={busy || (mode === "update" && authLoading)} className="w-full rounded-xl bg-brand px-4 py-3 font-bold text-white disabled:opacity-60">{busy || (mode === "update" && authLoading) ? t("auth.wait") : mode === "login" ? t("auth.login") : mode === "signup" ? t("auth.createAccount") : mode === "forgot" ? t("auth.sendResetLink") : t("auth.updatePassword")}</button>
        </form>
      </section>
    </main>
  );
}
