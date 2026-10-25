// Base of absolute URLs the api hands out (signed recording URLs, avatar
// URLs), e.g. https://api.example.com (a path prefix is kept). Unset → taken
// from the request that asks for them, which is only right when clients reach
// the api directly.
export const parsePublicUrl = (
  value: string | undefined,
): string | undefined => {
  if (!value) {
    return undefined;
  }
  const url = URL.parse(value);
  if (!url || !['http:', 'https:'].includes(url.protocol) || url.search) {
    throw new Error(
      `API_PUBLIC_URL must be an http(s) URL like "https://api.example.com", got "${value}"`,
    );
  }
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
};
