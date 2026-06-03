export const DEFAULT_ROOM_SLUG = "default";

const SAFE_ROOM_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/i;

// Room slugs become URL segments and database keys, so keep them narrow.
export const normalizeRoomSlug = (value: string | undefined, defaultSlug = DEFAULT_ROOM_SLUG): string => {
  const slug = value?.trim() ?? "";
  return SAFE_ROOM_SLUG_PATTERN.test(slug) ? slug.toLowerCase() : defaultSlug;
};
