import { useSettings } from "../context/SettingsContext";
const medals = ["🥇", "🥈", "🥉"];

/** "Top Reporters This Week" - ranked list with proportional bars. */
export default function Leaderboard({ prices = [] }) {
  const { t, lang } = useSettings();
  const top = [...prices]
    .filter((entry) => entry.country !== "Global" && entry.usdPrice > 0)
    .sort((a, b) => a.usdPrice - b.usdPrice)
    .slice(0, 3);
  const highest = top[0]?.usdPrice || 1;

  return (
    <section className="max-w-3xl mx-auto px-4 py-14">
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900">
          🏆 {lang === "pn" ? "Top 3 Lowest Sample Prices" : "Top 3 Lowest Sample Prices"}
        </h2>
        <p className="text-gray-500 mt-1">
          {lang === "pn"
            ? "Na demo estimate and simulation, no be confirmed market price"
            : "Demo estimates and simulations only—not verified current market prices"}
        </p>
      </div>

      <ol className="bg-white rounded-3xl shadow-lg divide-y divide-gray-100 overflow-hidden">
        {top.map((entry, i) => (
          <li key={entry.id} className="px-5 py-4 hover:bg-emerald-50/60 transition-colors">
            <div className="flex items-center gap-3">
              <span className="w-9 text-center text-2xl shrink-0" aria-label={`#${i + 1}`}>
                {medals[i] ?? <span className="text-base font-bold text-gray-400">{i + 1}</span>}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-bold text-gray-900 truncate">
                    {entry.market} <span className="font-medium text-gray-500">· {entry.city}</span>
                  </span>
                  <span className="text-sm font-extrabold text-brand whitespace-nowrap">
                    ${entry.usdPrice.toFixed(2)}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bar-fill h-full rounded-full bg-brand"
                    style={{ width: `${(highest / entry.usdPrice) * 100}%`, animationDelay: `${i * 90}ms` }}
                  />
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
