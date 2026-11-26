import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { readLocalCache, writeLocalCache } from "../lib/localCache";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  const loadProfile = useCallback(async (user) => {
    if (!user || !supabase) {
      setProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id,name,phone,store_name,whatsapp_number,show_whatsapp,group_link,role,market,data_saver,auto_download_vn,sync_only_wifi,notify_message,notify_call,notify_brief,notify_sound,notify_vibrate,do_not_disturb,timezone,push_player_id,last_seen")
      .eq("id", user.id)
      .maybeSingle();
    if (error) {
      console.error("Could not load profile:", error);
      setProfile(readLocalCache(`market-eye-profile-${user.id}`));
      return;
    }
    setProfile(data);
    if (data) writeLocalCache(`market-eye-profile-${user.id}`, data);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error("Could not restore session:", error);
      if (!active) return;
      setSession(data.session);
      setLoading(false);
      if (data.session?.user) void loadProfile(data.session.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (!nextSession?.user) {
        setProfile(null);
        setLoading(false);
      } else {
        queueMicrotask(() => {
          if (active) void loadProfile(nextSession.user);
        });
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo(
    () => ({ session, user: session?.user ?? null, profile, loading, refreshProfile: () => loadProfile(session?.user) }),
    [session, profile, loading, loadProfile]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
