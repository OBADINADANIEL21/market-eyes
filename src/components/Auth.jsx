import { useState } from "react";
import { supabase } from "../lib/supabase";

const inputClass = "w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3";

export default function Auth({ goTo }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", role: "buyer", market: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!supabase) {
      setMessage("Sign-in is temporarily unavailable. Please try again later.");
      return;
    }
    setBusy(true);
    setMessage("");
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

      setMessage(data.session ? "Account created. Welcome to MARKET EYE!" : "Check your email to confirm your account, then log in.");
      if (data.session) goTo("home");
    } catch (error) {
      console.error("Authentication request failed:", error);
      setMessage(mode === "login" ? "Could not log in. Check your details and try again." : "Could not create your account. Please check your details and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
      <section className="rounded-3xl bg-white p-6 shadow-lg md:p-8">
        <h1 className="mb-2 text-3xl font-extrabold text-gray-900">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="mb-6 text-gray-500">Sign in to MARKET EYE to use seller tools and community features.</p>
        <div className="mb-5 flex gap-2">
          {["login", "signup"].map((item) => (
            <button key={item} type="button" onClick={() => { setMode(item); setMessage(""); }}
              className={`flex-1 rounded-xl px-4 py-2 font-bold capitalize ${mode === item ? "bg-brand text-white" : "bg-gray-100 text-gray-700"}`}>
              {item === "login" ? "Log in" : "Sign up"}
            </button>
          ))}
        </div>
        <form className="space-y-4" onSubmit={submit}>
          {mode === "signup" && <>
            <label className="block text-sm font-semibold">Name<input className={inputClass} name="name" autoComplete="name" required value={form.name} onChange={change} /></label>
            <label className="block text-sm font-semibold">Phone<input className={inputClass} name="phone" type="tel" autoComplete="tel" required value={form.phone} onChange={change} /></label>
            <label className="block text-sm font-semibold">Account type<select className={inputClass} name="role" value={form.role} onChange={change}><option value="buyer">Buyer</option><option value="seller">Seller</option></select></label>
            <label className="block text-sm font-semibold">Preferred market<input className={inputClass} name="market" required value={form.market} onChange={change} placeholder="Market or area" /></label>
          </>}
          <label className="block text-sm font-semibold">Email<input className={inputClass} name="email" type="email" autoComplete="email" required value={form.email} onChange={change} /></label>
          <label className="block text-sm font-semibold">Password<input className={inputClass} name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength="8" required value={form.password} onChange={change} /></label>
          {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
          <button disabled={busy} className="w-full rounded-xl bg-brand px-4 py-3 font-bold text-white disabled:opacity-60">{busy ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}</button>
        </form>
      </section>
    </main>
  );
}
