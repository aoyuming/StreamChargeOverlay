import { DEFAULT_ROOM_SLUG, normalizeRoomSlug } from "../../shared/RoomSlug";

const ROOM_PAGE_PATTERN = /^\/rooms\/([^/]+)\/(?:display|overlay|admin)\.html$/;

// Keeps room URL parsing in one place so display/admin clients can share it.
// Legacy pages intentionally map to the default room for existing OBS links.
export class RoomContext {
  public constructor(public readonly slug: string) {}

  public static fromPath(pathname: string, defaultSlug = DEFAULT_ROOM_SLUG): RoomContext {
    const match = ROOM_PAGE_PATTERN.exec(pathname);
    if (!match) {
      return new RoomContext(defaultSlug);
    }

    return new RoomContext(normalizeRoomSlug(match[1], defaultSlug));
  }
}
