import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { BACKEND_URL } from "./sources/backend";

// The publishable key is meant to ship inside apps; row-level security protects the data.
const PUBLISHABLE_KEY = "sb_publishable_C_0iupZ07711L9WezvB38w_wfqMmKQN";

export const supabase = createClient(BACKEND_URL!, PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
});
