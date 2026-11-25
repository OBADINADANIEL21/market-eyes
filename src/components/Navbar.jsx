import { useSettings } from "../context/SettingsContext";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

/** Interface language selector */
function LanguageToggle() {
  const { lang, setLang } = useSettings();
  const options = [
    { code: "en", label: "EN" },
    { code: "pn", label: "Pidgin" },
    { code: "yo", label: "Yorùbá" },
    { code: "ig", label: "Igbo" },
    { code: "ha", label: "Hausa" },
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

export default function Navbar({ pages, page, setPage }) {
  const { t, mama } = useSettings();
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md shadow-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-3 py-3 xl:flex-row xl:items-center xl:justify-between">
        <button
          onClick={() => setPage("home")}
          className="flex shrink-0 items-center gap-2 self-start"
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

        <nav className="w-full min-w-0 xl:flex-1" aria-label="Main">
          <div className="no-scrollbar flex min-w-0 gap-1 overflow-x-auto xl:justify-center">
            {Object.entries(pages).filter(([key]) => key !== "auth").map(([key, { labelKey, icon }]) => (
              <button
                key={key}
                onClick={() => setPage(key)}
                aria-current={page === key ? "page" : undefined}
                aria-label={t(labelKey)}
                className={`nav-btn flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors duration-200 ${
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

        <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end xl:flex-nowrap">
          <LanguageToggle />
          <MamaToggle />
          {user ? (
            <button
              type="button"
              onClick={async () => {
                const { error } = await supabase.auth.signOut();
                if (error) console.error("Could not sign out:", error);
                else setPage("home");
              }}
              className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:border-brand hover:text-brand"
            >
              {mama ? "↪" : t("nav.logout")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPage("auth")}
              className="rounded-xl bg-brand px-3 py-2 text-xs font-bold text-white"
            >
              {mama ? "👤" : t("nav.auth")}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
