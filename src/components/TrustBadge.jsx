import { useSettings } from "../context/SettingsContext";

/** Trust score line: "Verified by X people today ✅" plus the all-time count. */
export default function TrustBadge({ today, total }) {
  const { t } = useSettings();
  const score = Math.min(100, Math.max(0, Math.round(((total || 0) / 400) * 100)));

  return (
    <div className="mt-4">
      <div className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
        <span className="live-dot inline-block w-2 h-2 rounded-full bg-brand" aria-hidden="true" />
        {t("trust.today", { n: today })}
      </div>
      {total != null && (
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[11px] text-gray-500">Trust Score</span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
            {score}%
          </span>
          <span className="text-[11px] text-gray-400">{t("card.verifiedAll", { n: total })}</span>
        </div>
      )}
    </div>
  );
}
