import { useSettings } from "../context/SettingsContext";
import { useLivePrices } from "../hooks/useLivePrices";
import PriceCard from "./PriceCard";
import Leaderboard from "./Leaderboard";
import ReporterLive from "./ReporterLive";

// Preferred items shown first when approved listings exist ([item, city]).
const steps = [
  { step: "1", icon: "🔎", key: "check" },
  { step: "2", icon: "⚖️", key: "compare" },
  { step: "3", icon: "📝", key: "report" },
];

export default function Home({ goTo }) {
  const { t, mama, lang } = useSettings();
  const { prices, rates, loading, lastUpdated, now, dataSource, dataError } = useLivePrices();
  const featuredCandidates = [
    ["Rice (50kg)", "Lagos"],
    ["Tomatoes (1kg)", "Lagos"],
    ["Garri (1kg)", "Lagos"],
  ]
    .map(([item, city]) => prices.find((p) => p.item === item && p.city === city))
    .filter(Boolean);
  const featured = featuredCandidates.length ? featuredCandidates : prices.slice(0, 3);
  const countryCount = new Set(prices.map((entry) => entry.country)).size;
  const marketCount = new Set(prices.map((entry) => entry.market)).size;

  return (
    <div>
      {/* ===== HERO ===== */}
      <section className="bg-gradient-to-br from-brand via-brand to-brand-dark text-white">
        <div className="max-w-7xl mx-auto px-4 py-16 md:py-28 text-center">
          {!mama && (
            <span className="inline-block bg-white/15 text-emerald-100 text-xs md:text-sm font-semibold px-4 py-1.5 rounded-full mb-6 tracking-wide">
              {t("hero.badge")}
            </span>
          )}
          {/* whitespace-pre-line turns the \n in the translation into a line break */}
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-5 hero-animate whitespace-pre-line">
            {t("hero.title")}
          </h1>
          {!mama && (
            <p className="text-lg md:text-2xl text-emerald-100 mb-10 max-w-2xl mx-auto">
              {t("hero.subtitle")}
            </p>
          )}
          <button
            onClick={() => goTo("search")}
            className={`bg-white text-brand font-bold text-lg px-10 py-4 rounded-2xl shadow-xl hover:scale-105 transition-transform duration-200 ${
              mama ? "mt-6" : ""
            }`}
          >
            {lang === "pn" ? "Find Cheap Market" : t("hero.cta")}
          </button>

          {!mama && (
            <div className="grid grid-cols-3 gap-4 mt-14 max-w-2xl mx-auto text-sm md:text-base">
              <div>
                <div className="text-2xl md:text-3xl font-extrabold">{marketCount}</div>
                <div className="text-emerald-200">{t("stats.markets")}</div>
              </div>
              <div>
                <div className="text-2xl md:text-3xl font-extrabold">{prices.length}</div>
                <div className="text-emerald-200">{t("stats.prices")}</div>
              </div>
              <div>
                <div className="text-2xl md:text-3xl font-extrabold">{countryCount}</div>
                <div className="text-emerald-200">{t("stats.countries")}</div>
              </div>
            </div>
          )}
        </div>
      </section>

      <ReporterLive prices={prices} now={now} />

      {dataSource !== "supabase" && !loading && (
        <div className="max-w-7xl mx-auto px-4 pt-5">
          <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {dataError ? "Price listings could not be loaded. Check your connection and try again." : "No verified market prices are available yet. We do not display estimated prices."}
          </div>
        </div>
      )}

      {/* ===== FEATURED PRICES ===== */}
      <section className="max-w-7xl mx-auto px-4 py-14">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900">
              {t("featured.title")}
            </h2>
            {!mama && <p className="text-gray-500 mt-1">{t("featured.subtitle")}</p>}
          </div>
          {!mama && (
            <button
              onClick={() => goTo("search")}
              className="hidden md:block text-brand font-semibold hover:underline"
            >
              {lang === "pn" ? "Na Here Cheap Pass" : t("featured.seeAll")}
            </button>
          )}
        </div>

        {featured.length > 0 ? <div className={`grid gap-6 ${mama ? "grid-cols-1" : "md:grid-cols-3"}`}>
          {featured.map((entry, i) => (
            <div key={entry.id} className="card-enter" style={{ animationDelay: `${i * 100}ms` }}>
              <PriceCard
                entry={entry}
                showChart={false}
                loading={loading}
                lastUpdated={lastUpdated}
                now={now}
                rates={rates}
                goTo={goTo}
              />
            </div>
          ))}
        </div> : loading ? <div className="grid gap-6 md:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-52 animate-pulse rounded-2xl bg-gray-200" />)}</div> : <p className="rounded-2xl bg-white p-5 text-gray-600">No price listings are available yet. Check back soon or report a local price.</p>}
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="bg-gray-50 py-14">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 text-center mb-10">
            {t("how.title")}
          </h2>
          <div className={`grid gap-6 ${mama ? "grid-cols-1" : "md:grid-cols-3"}`}>
            {steps.map(({ step, icon, key }) => (
              <div
                key={step}
                className="price-card bg-white rounded-2xl shadow p-6 text-center"
              >
                <div className="w-12 h-12 mx-auto bg-brand text-white rounded-full flex items-center justify-center font-extrabold text-xl mb-4">
                  {mama ? icon : step}
                </div>
                <h3 className="font-bold text-lg text-gray-900 mb-2">{t(`how.${key}`)}</h3>
                {!mama && <p className="text-gray-500 text-sm">{t(`how.${key}Desc`)}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== LEADERBOARD ===== */}
      <Leaderboard prices={prices} dataSource={dataSource} />
      <div className="pb-6 text-center">
        <button onClick={() => goTo("brief")} className="mr-2 rounded-xl bg-brand px-5 py-3 font-bold text-white">Daily price brief</button>
        <button onClick={() => goTo("heatmap")} className="mr-2 rounded-xl border border-brand px-5 py-3 font-bold text-brand">Market heat map</button>
        <button onClick={() => goTo("seasons")} className="mr-2 rounded-xl border border-brand px-5 py-3 font-bold text-brand">Season calendar</button>
        <button onClick={() => goTo("sellers")} className="rounded-xl border border-brand px-5 py-3 font-bold text-brand">Browse top sellers</button>
      </div>

    </div>
  );
}
