import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "./supabase";
import { codeFromUrl, errorFromUrl } from "./auth-url";

WebBrowser.maybeCompleteAuthSession();

/** Opens Google sign-in in a browser sheet and returns to the app. Works in Expo Go. */
export async function signInWithGoogle(): Promise<"signed-in" | "cancelled"> {
  const redirectTo = Linking.createURL("auth-callback");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data?.url) throw new Error(error?.message ?? "Google sign-in isn't available yet.");
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") return "cancelled";
  const code = codeFromUrl(result.url);
  if (!code) throw new Error(errorFromUrl(result.url) ?? "Sign-in didn't finish. Try again.");
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw new Error(exchangeError.message);
  return "signed-in";
}

export async function signOut() {
  await supabase.auth.signOut();
}
