import { useEffect, useMemo, useRef, useState } from "react";
import { getItemEmoji, prices } from "../data";
import { useSettings } from "../context/SettingsContext";
import useLocalStorage from "../hooks/useLocalStorage";
import EmptyState from "./EmptyState";

// Same key as the original app, so reports saved before the upgrade still show up.
const STORAGE_KEY = "market-eye-reports";

const emptyForm = {
  name: "",
  country: "Nigeria",
  city: "Lagos",
  market: "",
  item: "",
  unit: "",
  currency: "NGN",
  price: "",
};

// Form fields: `list` links an input to a <datalist> of suggestions.
const fields = [
  { name: "name", labelKey: "report.name", placeholder: "e.g. Adaeze Okafor" },
  { name: "country", labelKey: "report.country", placeholder: "e.g. Nigeria", list: "me-countries" },
  { name: "city", labelKey: "report.city", placeholder: "e.g. Lagos", list: "me-cities" },
  { name: "market", labelKey: "report.market", placeholder: "e.g. Mile 12 Market", list: "me-markets" },
  { name: "item", labelKey: "report.item", placeholder: "e.g. Beans", list: "me-items" },
  { name: "unit", labelKey: "report.unit", placeholder: "e.g. 1kg, 50kg bag, bunch" },
  { name: "currency", labelKey: "report.currency", placeholder: "e.g. NGN", list: "me-currencies" },
  { name: "price", labelKey: "report.price", placeholder: "e.g. 78000", type: "number" },
];

const unique = (key) => [...new Set(prices.map((p) => p[key]))];
const currencies = ["NGN", "KES", "INR", "PHP", "GHS", "ZAR", "GBP", "CAD", "AUD", "BRL", "USD"];
const reportItems = [
  ...unique("item"),
  "Beans (1kg)",
  "Plantain (1 bunch)",
];

export default function Report() {
  const { t, mama } = useSettings();
  const [form, setForm] = useState(emptyForm);
  const [submitted, setSubmitted] = useState(false);
  // Saved on this device and restored after a reload
  const [reports, setReports] = useLocalStorage(STORAGE_KEY, []);
  const timer = useRef(null);

  // Suggestions for the form inputs
  const suggestions = useMemo(
    () => ({
      "me-countries": unique("country"),
      "me-cities": unique("city"),
      "me-markets": unique("market"),
      "me-items": reportItems,
      "me-currencies": currencies,
    }),
    []
  );

  // Clear the "thank you" timer if the page is left early
  useEffect(() => () => clearTimeout(timer.current), []);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const newReport = {
      id: Date.now(),
      name: form.name.trim(),
      country: form.country.trim(),
      city: form.city.trim(),
      market: form.market.trim(),
      item: form.item.trim(),
      unit: form.unit.trim(),
      currency: form.currency.trim().toUpperCase(),
      price: Number(form.price),
      date: new Date().toLocaleDateString(),
    };
    setReports((prev) => [newReport, ...prev]);
    setForm(emptyForm);
    setSubmitted(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSubmitted(false), 4000);
  };

  const clearAll = () => {
    if (window.confirm(t("report.clearConfirm"))) setReports([]);
  };

  const inputCls =
    "w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-brand focus:outline-none font-medium bg-white";

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-2">{t("report.title")}</h1>
      {!mama && <p className="text-gray-500 mb-8">{t("report.subtitle")}</p>}
      <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950">
        {t("report.localOnly")}
      </div>

      {submitted && (
        <div
          role="status"
          className="bg-emerald-100 border-2 border-brand text-brand font-bold rounded-2xl px-5 py-4 mb-6 hero-animate"
        >
          {t("report.thanks")}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-lg p-6 md:p-8 grid md:grid-cols-2 gap-5 mb-10"
      >
        {fields.map(({ name, labelKey, placeholder, list, type }) => (
          <div key={name}>
            <label htmlFor={`f-${name}`} className="block text-sm font-semibold text-gray-700 mb-1">
              {t(labelKey)}
            </label>
            <input
              id={`f-${name}`}
              required
              name={name}
              type={type || "text"}
              min={type === "number" ? "0.01" : undefined}
              step={type === "number" ? "any" : undefined}
              list={list}
              value={form[name]}
              onChange={handleChange}
              placeholder={placeholder}
              className={inputCls}
            />
          </div>
        ))}

        {/* Autocomplete suggestions built from the existing price data */}
        {Object.entries(suggestions).map(([id, values]) => (
          <datalist key={id} id={id}>
            {values.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        ))}

        <button
          type="submit"
          className="md:col-span-2 bg-brand text-white font-bold text-lg py-4 rounded-2xl shadow-lg hover:scale-[1.02] hover:bg-brand-dark active:scale-95 transition-all duration-200"
        >
          {t("report.submit")}
        </button>
      </form>

      {reports.length === 0 ? (
        <EmptyState
          icon="📝"
          title={t("report.emptyTitle")}
          message={mama ? undefined : t("report.emptyBody")}
        />
      ) : (
        <div>
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-2xl font-extrabold text-gray-900">
              {t("report.community", { n: reports.length })}
            </h2>
            <button
              onClick={clearAll}
              className="text-sm font-semibold text-gray-400 hover:text-red-600 transition-colors"
            >
              {t("report.clear")}
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {reports.map((r, i) => (
              // Older saved reports have no id, so fall back to the index
              <div
                key={r.id ?? i}
                className="price-card card-enter bg-white rounded-2xl shadow p-5 border-l-4 border-brand"
              >
                <div className="font-bold text-gray-900">
                  <span aria-hidden="true">{getItemEmoji(r.item)}</span> {r.item}
                  {r.unit && <span className="font-medium"> · {r.unit}</span>}
                </div>
                <div className="text-xl font-extrabold text-brand mt-1">
                  {r.currency || "NGN"} {Number(r.price).toLocaleString()}
                </div>
                {!mama && (
                  <>
                    <div className="text-sm text-gray-500 mt-2">
                      {r.market}, {r.city}, {r.country}
                    </div>
                    <div className="text-xs text-gray-400 mt-3">
                      {t("report.by", {
                        name: r.name,
                        date: r.date,
                      })}
                    </div>
                  </>
                )}
                <div className="mt-2 text-xs font-semibold text-amber-800">
                  {t("report.unverified")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
