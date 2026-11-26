import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthNames(values = []) {
  return values.map((value) => months[value - 1]).filter(Boolean).join(", ");
}

export default function SeasonCalendar() {
  const { profile } = useAuth();
  const [seasons, setSeasons] = useState([]);
  const [form, setForm] = useState({ item: "", cheap_months: [], costly_months: [], notes: "" });
  const [editingItem, setEditingItem] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!supabase) {
      setNotice("Season data is unavailable because the database is not configured.");
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.from("seasons")
      .select("item,cheap_months,costly_months,notes,updated_at")
      .order("item");
    if (error) {
      console.error("Could not load seasonal price data:", error);
      setNotice("Season data could not be loaded. Check that the market-tools SQL migration has been run.");
    } else {
      setSeasons(data ?? []);
      setNotice("");
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggleMonth = (field, month) => setForm((current) => ({
    ...current,
    [field]: current[field].includes(month)
      ? current[field].filter((value) => value !== month)
      : [...current[field], month].sort((a, b) => a - b),
  }));

  const editSeason = (season) => {
    setEditingItem(season.item);
    setForm({
      item: season.item,
      cheap_months: season.cheap_months ?? [],
      costly_months: season.costly_months ?? [],
      notes: season.notes ?? "",
    });
  };

  const saveSeason = async (event) => {
    event.preventDefault();
    if (profile?.role !== "admin") return;
    setSaving(true);
    setNotice("");
    try {
      const { error } = await supabase.from("seasons").upsert({
        item: form.item.trim(),
        cheap_months: form.cheap_months,
        costly_months: form.costly_months,
        notes: form.notes.trim(),
        updated_by: (await supabase.auth.getUser()).data.user?.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "item" });
      if (error) throw error;
      setForm({ item: "", cheap_months: [], costly_months: [], notes: "" });
      setEditingItem("");
      setNotice("Season information saved.");
      await load();
    } catch (error) {
      console.error("Could not save seasonal price data:", error);
      setNotice("Could not save. Confirm your admin access and try again.");
    } finally {
      setSaving(false);
    }
  };

  const deleteSeason = async (item) => {
    if (profile?.role !== "admin" || !window.confirm(`Remove season data for ${item}?`)) return;
    if (!supabase) {
      setNotice("Season data is unavailable because the database is not configured.");
      return;
    }
    const { error } = await supabase.from("seasons").delete().eq("item", item);
    if (error) {
      console.error("Could not delete season data:", error);
      setNotice("Could not remove the season entry.");
    } else {
      setNotice("Season entry removed.");
      await load();
    }
  };

  return <main className="mx-auto max-w-5xl px-4 py-8">
    <h1 className="text-3xl font-extrabold">Season calendar</h1>
    <p className="mt-2 text-gray-600">See when locally reported goods are usually cheaper or more expensive. Months appear only after an administrator adds verified seasonal information.</p>
    {notice && <p role="status" className="my-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">{notice}</p>}
    {loading ? <p role="status" className="py-6">Loading season information…</p> : seasons.length ? <div className="mt-5 grid gap-3 md:grid-cols-2">
      {seasons.map((season) => <article key={season.item} className="rounded-2xl bg-white p-5 shadow">
        <div className="flex items-start justify-between gap-3"><h2 className="text-xl font-bold">{season.item}</h2>{profile?.role === "admin" && <div className="flex gap-2"><button type="button" onClick={() => editSeason(season)} className="text-sm font-bold text-brand">Edit</button><button type="button" onClick={() => void deleteSeason(season.item)} className="text-sm font-bold text-red-700">Remove</button></div>}</div>
        <p className="mt-3"><span className="font-semibold text-emerald-800">Cheaper:</span> {monthNames(season.cheap_months) || "Not recorded"}</p>
        <p className="mt-1"><span className="font-semibold text-amber-800">Costlier:</span> {monthNames(season.costly_months) || "Not recorded"}</p>
        {season.notes && <p className="mt-3 text-sm text-gray-600">{season.notes}</p>}
      </article>)}
    </div> : <p className="mt-5 rounded-2xl bg-white p-6 text-gray-600 shadow">No seasonal price data has been entered yet. We don’t show guessed seasons.</p>}

    {profile?.role === "admin" && <form onSubmit={saveSeason} className="mt-7 space-y-4 rounded-2xl bg-white p-5 shadow">
      <h2 className="text-xl font-bold">{editingItem ? `Edit ${editingItem}` : "Add seasonal information"}</h2>
      <label className="block text-sm font-semibold">Item or service<input required value={form.item} disabled={Boolean(editingItem)} onChange={(event) => setForm((current) => ({ ...current, item: event.target.value }))} className="mt-1 w-full rounded-xl border px-4 py-3 disabled:bg-gray-100" placeholder="e.g. Fresh mangoes" /></label>
      {[["cheap_months", "Cheaper months"], ["costly_months", "Costlier months"]].map(([field, label]) => <fieldset key={field}>
        <legend className="mb-2 text-sm font-semibold">{label}</legend>
        <div className="flex flex-wrap gap-2">{months.map((month, index) => <label key={month} className="flex items-center gap-1 rounded-lg border px-2 py-1 text-sm"><input type="checkbox" checked={form[field].includes(index + 1)} onChange={() => toggleMonth(field, index + 1)} />{month}</label>)}</div>
      </fieldset>)}
      <label className="block text-sm font-semibold">Notes (source or context)<textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="mt-1 min-h-20 w-full rounded-xl border px-4 py-3" /></label>
      <div className="flex gap-2"><button disabled={saving} className="rounded-xl bg-brand px-5 py-3 font-bold text-white disabled:opacity-50">{saving ? "Saving…" : "Save season info"}</button>{editingItem && <button type="button" onClick={() => { setEditingItem(""); setForm({ item: "", cheap_months: [], costly_months: [], notes: "" }); }} className="rounded-xl border px-5 py-3 font-semibold">Cancel</button>}</div>
    </form>}
  </main>;
}
