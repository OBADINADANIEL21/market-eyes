import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { translations } from "../i18n";

/**
 * Global UI settings: Mama Mode + language (English / Pidgin).
 * Persisted in localStorage so they survive a page reload.
 */
const STORAGE_KEY = "market-eye-settings";
const SettingsContext = createContext(null);

const loadSettings = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return { mama: Boolean(saved.mama), lang: saved.lang === "pn" ? "pn" : "en" };
  } catch {
    return { mama: false, lang: "en" };
  }
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* storage may be unavailable (private mode) - ignore */
    }
  }, [settings]);

  // Translate a key, falling back to English, then to the key itself.
  const t = useCallback(
    (key, vars = {}) => {
      const text = translations[settings.lang]?.[key] ?? translations.en[key] ?? key;
      return text.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? `{${name}}`);
    },
    [settings.lang]
  );

  const value = useMemo(
    () => ({
      mama: settings.mama,
      lang: settings.lang,
      toggleMama: () => setSettings((s) => ({ ...s, mama: !s.mama })),
      setLang: (lang) => setSettings((s) => ({ ...s, lang })),
      t,
    }),
    [settings, t]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside <SettingsProvider>");
  return ctx;
}
