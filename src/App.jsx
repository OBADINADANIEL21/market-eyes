import { Component, Suspense, lazy, useEffect, useMemo, useState } from "react";
import { SettingsProvider, useSettings } from "./context/SettingsContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { supabase } from "./lib/supabase";
import { syncOfflineQueue } from "./lib/offlineQueue";

const Home = lazy(() => import("./components/Home"));
const Search = lazy(() => import("./components/Search"));
const Compare = lazy(() => import("./components/Compare"));
const BulkCompare = lazy(() => import("./components/BulkCompare"));
const PriceBrief = lazy(() => import("./components/PriceBrief"));
const HeatMap = lazy(() => import("./components/HeatMap"));
const SeasonCalendar = lazy(() => import("./components/SeasonCalendar"));
const Report = lazy(() => import("./components/Report"));
const Auth = lazy(() => import("./components/Auth"));
const Markets = lazy(() => import("./components/Markets"));
const Seller = lazy(() => import("./components/Seller"));
const Pending = lazy(() => import("./components/Pending"));
const Messages = lazy(() => import("./components/Messages"));
const Chat = lazy(() => import("./components/Chat"));
const Profile = lazy(() => import("./components/Profile"));
const PendingSync = lazy(() => import("./components/PendingSync"));
const VerifiedSellers = lazy(() => import("./components/VerifiedSellers"));

const pages = {
  home: { labelKey: "nav.home", label: "Home", icon: "🏠", component: Home, path: "/" },
  markets: { labelKey: "nav.markets", label: "Markets", icon: "🛍️", component: Markets, path: "/markets" },
  search: { labelKey: "nav.search", label: "Search Prices", icon: "🔎", component: Search, path: "/search" },
  compare: { labelKey: "nav.compare", label: "Compare", icon: "⚖️", component: Compare, path: "/compare" },
  bulk: { labelKey: "nav.compare", label: "Bulk compare", icon: "🧺", component: BulkCompare, path: "/compare-bulk" },
  brief: { labelKey: "nav.home", label: "Daily brief", icon: "📰", component: PriceBrief, path: "/brief" },
  heatmap: { labelKey: "nav.markets", label: "Market heat map", icon: "🗺️", component: HeatMap, path: "/heat-map" },
  seasons: { labelKey: "nav.markets", label: "Season calendar", icon: "🗓️", component: SeasonCalendar, path: "/season" },
  report: { labelKey: "nav.report", label: "Report", icon: "📝", component: Report, path: "/report" },
  auth: { labelKey: "nav.auth", label: "Log in", icon: "🔐", component: Auth, path: "/auth" },
  seller: { labelKey: "nav.seller", label: "Seller", icon: "🏪", component: Seller, path: "/seller", protected: true },
  sellers: { labelKey: "nav.sellers", label: "Top Sellers", icon: "⭐", component: VerifiedSellers, path: "/sellers" },
  pending: { labelKey: "nav.pending", label: "Review", icon: "✅", component: Pending, path: "/pending", protected: true },
  messages: { labelKey: "nav.messages", label: "Messages", icon: "💬", component: Messages, path: "/messages", protected: true },
  chat: { labelKey: "nav.messages", label: "Chat", icon: "💬", component: Chat, path: "/chat", protected: true },
  profile: { labelKey: "nav.profile", label: "Profile", icon: "👤", component: Profile, path: "/profile", protected: true },
  "pending-sync": { labelKey: "nav.sync", label: "Pending sync", icon: "⏳", component: PendingSync, path: "/pending-sync", protected: true },
};

function routeFromLocation() {
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  if (hashParams.get("type") === "recovery") {
    return { page: "auth", chatId: null, authMode: "update" };
  }
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const chatMatch = path.match(/^\/chat\/([^/]+)$/);
  if (chatMatch) return { page: "chat", chatId: decodeURIComponent(chatMatch[1]) };
  const entry = Object.entries(pages).find(([, page]) => page.path === path);
  return { page: entry?.[0] ?? "home", chatId: null, authMode: null };
}

class PageErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("Page failed to load:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="mx-auto max-w-lg p-8 text-center">
          <h1 className="text-xl font-bold">This page could not load.</h1>
          <p className="mt-2 text-gray-600">Check your connection, then reload the page.</p>
          <button type="button" className="mt-5 rounded-xl bg-brand px-5 py-3 font-bold text-white" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Shell() {
  const { mama } = useSettings();
  const { user, profile, loading } = useAuth();
  const [route, setRoute] = useState(routeFromLocation);
  const [online, setOnline] = useState(navigator.onLine);
  const [slowNetwork, setSlowNetwork] = useState(false);
  const [toast, setToast] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [missedCallCount, setMissedCallCount] = useState(0);
  const page = route.page;

  useEffect(() => {
    document.getElementById("startup-splash")?.remove();
  }, []);

  const navigate = (nextPage, params = {}) => {
    const item = pages[nextPage] ?? pages.home;
    const path = nextPage === "chat" && params.chatId
      ? `/chat/${encodeURIComponent(params.chatId)}`
      : item.path;
    if (window.location.pathname !== path) window.history.pushState({}, "", path);
    setRoute({ page: nextPage, chatId: params.chatId ?? null, authMode: null });
  };

  useEffect(() => {
    const onPopState = () => setRoute(routeFromLocation());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (pages[page]?.protected && !loading && !user) navigate("auth");
  }, [page, loading, user]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [page, route.chatId]);

  useEffect(() => {
    const connection = navigator.connection;
    const updateNetwork = () => {
      setOnline(navigator.onLine);
      setSlowNetwork(["slow-2g", "2g"].includes(connection?.effectiveType));
    };
    const onOnline = () => {
      updateNetwork();
      void syncOfflineQueue({ syncOnlyWifi: profile?.sync_only_wifi });
    };
    const onOffline = () => updateNetwork();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    connection?.addEventListener?.("change", updateNetwork);
    updateNetwork();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      connection?.removeEventListener?.("change", updateNetwork);
    };
  }, [profile?.sync_only_wifi]);

  useEffect(() => {
    const onToast = (event) => {
      setToast(event.detail);
      window.setTimeout(() => setToast(""), 5000);
    };
    window.addEventListener("market-eye-toast", onToast);
    return () => window.removeEventListener("market-eye-toast", onToast);
  }, []);

  useEffect(() => {
    if (!user || !supabase) return undefined;
    const updatePresence = () => {
      if (navigator.onLine && document.visibilityState === "visible") {
        void supabase.from("profiles").update({
          last_seen: new Date().toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        }).eq("id", user.id);
      }
    };
    updatePresence();
    const timer = window.setInterval(updatePresence, 60_000);
    document.addEventListener("visibilitychange", updatePresence);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", updatePresence);
    };
  }, [user]);

  useEffect(() => {
    if (!user || !supabase) {
      setUnreadCount(0);
      setMissedCallCount(0);
      return undefined;
    }
    const refreshBadges = async () => {
      const [messageResult, callResult] = await Promise.all([
        supabase.from("messages").select("id", { count: "exact", head: true }).eq("receiver_id", user.id).eq("is_read", false),
        supabase.from("calls").select("id", { count: "exact", head: true }).eq("receiver_id", user.id).eq("status", "missed"),
      ]);
      if (messageResult.error || callResult.error) {
        console.warn("Could not refresh notification badges:", messageResult.error ?? callResult.error);
        return;
      }
      const unread = messageResult.count ?? 0;
      const missedCalls = callResult.count ?? 0;
      setUnreadCount(unread);
      setMissedCallCount(missedCalls);
      if (unread + missedCalls > 0) void navigator.setAppBadge?.(unread + missedCalls);
      else void navigator.clearAppBadge?.();
    };
    void refreshBadges();
    const channel = supabase.channel(`app-badges-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => void refreshBadges())
      .on("postgres_changes", { event: "*", schema: "public", table: "calls" }, () => void refreshBadges())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user]);

  const CurrentPage = pages[page]?.component ?? Home;
  const denied = page === "seller" && profile?.role !== "seller";
  const moderatorOnly = page === "pending" && !["moderator", "admin"].includes(profile?.role);
  const visiblePages = useMemo(() => Object.fromEntries(
    Object.entries(pages).filter(([key]) =>
      ["home", "markets", "search", "compare", "report"].includes(key) ||
      (key === "auth" && !user) ||
      (key === "seller" && profile?.role === "seller") ||
      (key === "pending" && ["moderator", "admin"].includes(profile?.role)) ||
      (["messages", "profile", "pending-sync"].includes(key) && Boolean(user))
    )
  ), [user, profile]);

  return (
    <div className={`min-h-screen bg-gray-50 font-sans text-gray-900 flex flex-col ${mama ? "mama-mode" : ""}`}>
      {!loading && <Navbar pages={visiblePages} page={page} setPage={navigate} />}
      {!online && <div role="status" className="bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-950">You are OFFLINE — showing last saved prices and chats. New items will sync when you reconnect.</div>}
      {online && slowNetwork && <div role="status" className="bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-900">Slow network — text-only mode; video calls are unavailable.</div>}
      {toast && <div role="status" className="fixed right-4 top-20 z-[70] rounded-xl bg-emerald-800 px-4 py-3 text-white shadow-lg">{toast}</div>}
      <main key={`${page}-${route.chatId ?? ""}`} className="page-enter flex-1 pb-20 md:pb-0">
        {loading && pages[page]?.protected ? (
          <div className="p-10 text-center" role="status">Loading your account…</div>
        ) : !user && pages[page]?.protected ? null : denied || moderatorOnly ? (
          <div className="mx-auto max-w-xl p-10 text-center" role="alert">
            <h1 className="text-2xl font-bold">This page is restricted</h1>
            <p className="mt-2 text-gray-600">Your account does not have permission to access this area.</p>
            <button className="mt-5 rounded-xl bg-brand px-5 py-3 font-bold text-white" onClick={() => navigate("home")}>Go home</button>
          </div>
        ) : (
          <PageErrorBoundary key={`${page}-${route.chatId ?? ""}`}>
            <Suspense fallback={<div className="p-10 text-center" role="status">Loading…</div>}>
              <CurrentPage goTo={navigate} chatId={route.chatId} authMode={route.authMode} />
            </Suspense>
          </PageErrorBoundary>
        )}
      </main>
      {user && (
        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-white/95 p-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] shadow-lg md:hidden" aria-label="Bottom navigation">
          {[["home", "🏠"], ["markets", "🛍️"], ["messages", "💬"], ["seller", "🏪"], ["profile", "👤"]]
            .filter(([key]) => key !== "seller" || profile?.role === "seller")
            .map(([key, icon]) => (
              <button key={key} onClick={() => navigate(key)} className={`min-h-12 rounded-lg text-xs font-semibold ${page === key || (key === "messages" && page === "chat") ? "text-brand" : "text-gray-500"}`}>
                <span className="relative block text-lg">{icon}{key === "messages" && (unreadCount + missedCallCount > 0) && <span className="absolute -right-2 -top-1 rounded-full bg-red-600 px-1.5 text-[10px] text-white">{unreadCount + missedCallCount}</span>}</span>{pages[key].label}
              </button>
            ))}
        </nav>
      )}
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </SettingsProvider>
  );
}
