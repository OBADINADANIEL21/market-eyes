import { formatPrice } from "../data";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/**
 * The chart uses recorded price-history rows, ordered oldest to newest.
 */
export default function PriceHistory({ history, historyDates = [], currency }) {
  const points = history.map((price, index) => ({
    price,
    day: historyDates[index]
      ? new Date(historyDates[index]).toLocaleDateString("en", { weekday: "short" })
      : `Day ${index + 1}`,
  }));
  const first = points[0]?.price ?? 0;
  const last = points[points.length - 1]?.price ?? 0;
  const change = first ? ((last - first) / first) * 100 : 0;
  const rising = change > 0;

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500">Recorded price history · last 7 days</span>
        <span className={`text-xs font-bold ${change === 0 ? "text-gray-600" : rising ? "text-red-600" : "text-green-700"}`}>
          {change === 0 ? "No change" : `${rising ? "Up" : "Down"} ${formatPrice(Math.abs(last - first), currency)} (${Math.abs(change).toFixed(1)}%)`}
        </span>
      </div>
      <div className="h-44 w-full" role="img" aria-label="Recorded price changes over the last 7 days">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis width={48} tick={{ fontSize: 10 }} tickFormatter={(value) => Number(value).toLocaleString()} />
            <Tooltip formatter={(value) => formatPrice(Number(value), currency)} />
            <Line type="monotone" dataKey="price" stroke="#0a7a42" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
