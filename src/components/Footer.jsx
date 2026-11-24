import { useSettings } from "../context/SettingsContext";

export default function Footer() {
  const { t, mama } = useSettings();

  return (
    <footer className="bg-brand text-white mt-16">
      <div className="max-w-7xl mx-auto px-4 py-10 text-center">
        <div className="text-xl font-extrabold mb-2">👁 MARKET EYE</div>
        {!mama && (
          <>
            <p className="text-emerald-200 text-sm max-w-md mx-auto">{t("footer.tagline")}</p>
            <p className="text-emerald-300/60 text-xs mt-6">{t("footer.copy")}</p>
          </>
        )}
      </div>
    </footer>
  );
}
