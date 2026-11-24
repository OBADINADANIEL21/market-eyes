import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://hvfqgeuiqwklpaxpmzwy.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigError = supabaseAnonKey
  ? null
  : "Supabase is missing VITE_SUPABASE_ANON_KEY. Add it to your local .env and Netlify environment variables.";

export const supabase = supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
