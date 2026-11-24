import { useSettings } from "../context/SettingsContext";

/** English / Pidgin segmented toggle */
function LanguageToggle() {
  const { lang, setLang } = useSettings();
  const options = [
    { code: "en", label: "EN" },
    { code: "pn", label: "Pidgin" },
  ];

  return (
    <div className="flex bg-gray-100 rounded-xl p-1" role="group" aria-label="Language">
      {options.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors duration-200 ${
            lang === code ? "bg-brand text-white shadow" : "text-gray-600 hover:text-brand"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Mama Mode on/off switch */
function MamaToggle() {
  const { mama, toggleMama, t } = useSettings();

  return (
    <button
      role="switch"
      aria-checked={mama}
      onClick={toggleMama}
      className={`flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-colors duration-200 ${
        mama
          ? "bg-amber-100 border-amber-400 text-amber-800"
          : "bg-white border-gray-200 text-gray-600 hover:border-brand hover:text-brand"
      }`}
    >
      <span className="text-lg" aria-hidden="true">
        👩🏾‍🍳
      </span>
      <span>{t("toggle.mama")}</span>
      <span
        aria-hidden="true"
        className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
          mama ? "bg-amber-500" : "bg-gray-300"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
            mama ? "translate-x-4" : ""
          }`}
        />
      </span>
    </button>
  );
}

/**
 * Sticky top navigation.
 * Mobile: logo + toggles on the first row, scrollable tabs below.
 * In Mama Mode the tabs show only big emoji icons.
 */
export default function Navbar({ pages, page, setPage }) {
  const { t, mama } = useSettings();

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        {/* Logo */}
        <button
          onClick={() => setPage("home")}
          className="order-1 flex items-center gap-2 shrink-0"
          aria-label="MARKET EYE"
        >
          <span className="logo-eye w-10 h-10 bg-brand text-white rounded-xl flex items-center justify-center text-xl font-extrabold">
            👁
          </span>
          {!mama && (
            <span className="text-xl md:text-2xl font-extrabold text-brand">
              MARKET <span className="text-gray-900">EYE</span>
            </span>
          )}
        </button>

        {/* Page tabs */}
        <nav className="order-3 md:order-2 w-full md:w-auto" aria-label="Main">
          <div className="flex gap-1 md:gap-2 overflow-x-auto no-scrollbar justify-between md:justify-start">
            {Object.entries(pages).map(([key, { labelKey, icon }]) => (
              <button
                key={key}
                onClick={() => setPage(key)}
                aria-current={page === key ? "page" : undefined}
                aria-label={t(labelKey)}
                className={`nav-btn flex items-center gap-1.5 px-3 md:px-5 py-2 rounded-xl font-semibold text-sm md:text-base whitespace-nowrap transition-colors duration-200 ${
                  page === key
                    ? "bg-brand text-white shadow"
                    : "text-gray-600 hover:text-brand hover:bg-brand-soft"
                }`}
              >
                <span aria-hidden="true">{icon}</span>
                {!mama && <span>{t(labelKey)}</span>}
              </button>
            ))}
          </div>
        </nav>

        {/* Toggles */}
        <div className="order-2 md:order-3 flex items-center gap-2">
          <LanguageToggle />
          <MamaToggle />
        </div>
      </div>
    </header>
  );
}
