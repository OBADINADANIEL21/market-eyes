import { useEffect, useState } from "react";
﻿import { useSettings } from "../context/SettingsContext";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const onPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setInstallPrompt(null);
    } catch (error) {
      console.error("Could not start app installation:", error);
      setMessage("Could not start installation. Use your browser menu to install this app.");
      setInstallPrompt(null);
    }
  };

  return (
    <>
      {installPrompt && !installed && <button
        type="button"
        onClick={() => void install()}
        className="rounded-xl border border-brand px-3 py-2 text-xs font-bold text-brand hover:bg-brand-soft"
      >
        Install app
      </button>}
      {message && <span role="status" className="text-xs text-gray-600">{message}</span>}
    </>
  );
}

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

export default function Navbar({ pages, page, setPage, searchValue, onSearchChange }) {
  const { t, mama } = useSettings();
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md shadow-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-3 py-3">
        <div className="flex flex-wrap items-center gap-3">
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

        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            setPage("search", { query: searchValue });
          }}
          className="order-last flex basis-full items-center gap-2 rounded-2xl border-2 border-gray-200 bg-gray-50 p-1.5 transition-colors focus-within:border-brand md:order-none md:min-w-0 md:flex-1 md:basis-auto"
        >
          <span className="pl-2 text-gray-400" aria-hidden="true">⌕</span>
          <input
            type="search"
            value={searchValue}
            onFocus={() => {
              if (page !== "search") setPage("search", { query: searchValue });
            }}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={mama ? "Find a price" : "Search products, markets and stores"}
            aria-label="Search products, markets and stores"
            className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none placeholder:text-gray-400"
          />
          <button
            type="submit"
            className="shrink-0 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-dark"
          >
            {mama ? "Find" : "Search"}
          </button>
        </form>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <LanguageToggle />
          <MamaToggle />
          <InstallAppButton />
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

        <nav className="w-full min-w-0 xl:flex-1" aria-label="Main">
          <div className="no-scrollbar flex min-w-0 gap-1 overflow-x-auto xl:justify-center">
            {Object.entries(pages).filter(([key]) => key !== "auth" && key !== "search").map(([key, { labelKey, icon }]) => (
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
      </div>
    </header>
  );
}
