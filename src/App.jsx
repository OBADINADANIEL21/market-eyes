import { useEffect, useState } from "react";
import { SettingsProvider, useSettings } from "./context/SettingsContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./components/Home";
import Search from "./components/Search";
import Compare from "./components/Compare";
import Report from "./components/Report";

// Page registry: labelKey is translated by the Navbar, icon shows on tabs.
const pages = {
  home: { labelKey: "nav.home", icon: "🏠", component: Home },
  search: { labelKey: "nav.search", icon: "🔎", component: Search },
  compare: { labelKey: "nav.compare", icon: "⚖️", component: Compare },
  report: { labelKey: "nav.report", icon: "📝", component: Report },
};

// Inner shell: reads settings, so it must live inside <SettingsProvider>.
function Shell() {
  const { mama } = useSettings();
  const [page, setPage] = useState("home");
  const ActivePage = pages[page].component;

  // Start every page at the top when navigating
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [page]);

  return (
    // `mama-mode` enlarges all text and tap targets (see index.css)
    <div
      className={`min-h-screen bg-gray-50 font-sans text-gray-900 flex flex-col ${
        mama ? "mama-mode" : ""
      }`}
    >
      <Navbar pages={pages} page={page} setPage={setPage} />

      {/* key={page} re-mounts the wrapper so the fade-in plays on every page change */}
      <main key={page} className="page-enter flex-1">
        <ActivePage goTo={setPage} />
      </main>

      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <Shell />
    </SettingsProvider>
  );
}
