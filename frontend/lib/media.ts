export function resolveMediaUrl(url?: string | null): string {
  if (!url) return "";
  if (/^https?:\/\//.test(url)) return url;

  const normalizedUrl = url.startsWith("/") ? url : `/${url}`;
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  // In the browser we normally proxy uploads through Next (/uploads/*). When
  // the native app is configured with an absolute backend API URL, however,
  // there is no Next proxy available, so point directly at that backend.
  if (apiBaseUrl && /^https?:\/\//.test(apiBaseUrl)) {
    const backendOrigin = apiBaseUrl.replace(/\/api\/?$/, "");
    return `${backendOrigin}${normalizedUrl}`;
  }

  return normalizedUrl;
}

export function getInitials(name?: string | null): string {
  return (
    String(name || "CA")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "CA"
  );
}
