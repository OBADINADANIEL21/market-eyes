import { useSettings } from "../context/SettingsContext";

/** Small pill showing whether a price is rising (bad, red) or falling (good, green). */
export default function TrendBadge({ trend, compact = false }) {
  const { t } = useSettings();
  const up = trend === "up";
  const stable = trend === "stable";
  const label = stable ? "—" : compact ? (up ? "▲" : "▼") : t(up ? "trend.up" : "trend.down");

  return (
    <span
      className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${
        stable ? "bg-gray-100 text-gray-600" : up ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
      }`}
    >
      {label}
    </span>
  );
}
