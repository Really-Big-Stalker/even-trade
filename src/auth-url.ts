/** Pure helpers for reading the OAuth return URL (kept separate so tests run without native modules). */
export function codeFromUrl(url: string): string | null {
  const m = url.match(/[?&#]code=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function errorFromUrl(url: string): string | null {
  const m = url.match(/[?&#]error_description=([^&#]+)/);
  return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : null;
}
