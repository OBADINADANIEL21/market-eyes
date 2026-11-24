import { useMemo } from "react";
import { useSettings } from "../context/SettingsContext";
import { formatPrice } from "../data";

/**
 * 7-day price bar chart built only with divs + Tailwind (no chart library).
 * Bar colour compares each day with the day before:
 *   red = price went up (worse for buyers), green = went down, grey = same / first day.
 * `history` is oldest -> newest, the last value is today's price.
 */
export default function PriceHistory({ history, currency }) {
  const { t } = useSettings();

  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;

  // Short weekday labels ending with today
  const labels = useMemo(
    () =>
      history.map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (history.length - 1 - i));
        return d.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2);
      }),
    [history.length]
  );

  const first = history[0];
  const last = history[history.length - 1];
  const change = ((last - first) / first) * 100;
  const rising = change > 0;

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500">{t("history.title")}</span>
        <span className={`text-xs font-bold ${rising ? "text-red-600" : "text-green-700"}`}>
          {rising ? "▲" : "▼"} {Math.abs(change).toFixed(1)}%
        </span>
      </div>

      <div
        className="h-20 w-full"
        role="img"
        aria-label={`${t("history.title")}: ${history.map((v) => formatPrice(v, currency)).join(", ")}`}
      >
        <svg viewBox="0 0 280 80" className="h-full w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="priceLineFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0a7a42" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#0a7a42" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {history.map((value, i) => {
            const x = history.length === 1 ? 140 : (i / (history.length - 1)) * 280;
            const y = 72 - ((value - min) / range) * 60;
            return (
              i > 0 ? (
                <line
                  key={`line-${i}`}
                  x1={((i - 1) / (history.length - 1)) * 280}
                  y1={72 - ((history[i - 1] - min) / range) * 60}
                  x2={x}
                  y2={y}
                  stroke={value >= history[i - 1] ? "#ef4444" : "#10b981"}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              ) : null
            );
          })}
          {history.map((value, i) => {
            const x = history.length === 1 ? 140 : (i / (history.length - 1)) * 280;
            const y = 72 - ((value - min) / range) * 60;
            return (
              <circle
                key={`point-${i}`}
                cx={x}
                cy={y}
                r={i === history.length - 1 ? "5" : "3"}
                fill={i === history.length - 1 ? "#0a7a42" : "#ffffff"}
                stroke="#0a7a42"
                strokeWidth="2"
              >
                <title>{labels[i]}: {formatPrice(value, currency)}</title>
              </circle>
            );
          })}
        </svg>
      </div>

      <div className="flex gap-1.5 mt-1">
        {labels.map((label, i) => (
          <span
            key={i}
            className={`flex-1 text-center text-[10px] ${
              i === labels.length - 1 ? "font-bold text-brand" : "text-gray-400"
            }`}
          >
            {i === labels.length - 1 ? t("history.today").slice(0, 3) : label}
          </span>
        ))}
      </div>
    </div>
  );
}
