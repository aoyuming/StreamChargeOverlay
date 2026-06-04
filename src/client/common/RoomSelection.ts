import type { RoomInfo } from "../../shared/types";
import { DEFAULT_ROOM_SLUG, normalizeRoomSlug } from "../../shared/RoomSlug";

export type RoomPageKind = "display" | "admin";

export const SELECTED_ROOM_STORAGE_KEY = "sponsorOverlaySelectedRoom";

export const roomPagePath = (slug: string, pageKind: RoomPageKind): string => {
  return `/rooms/${encodeURIComponent(slug)}/${pageKind}.html`;
};

export const savedRoomSlug = (storage: Storage): string => {
  return normalizeRoomSlug(storage.getItem(SELECTED_ROOM_STORAGE_KEY) ?? "", DEFAULT_ROOM_SLUG);
};

export const rememberRoomSlug = (storage: Storage, slug: string): void => {
  const normalizedSlug = normalizeRoomSlug(slug, DEFAULT_ROOM_SLUG);
  if (normalizedSlug === DEFAULT_ROOM_SLUG) {
    storage.removeItem(SELECTED_ROOM_STORAGE_KEY);
    return;
  }

  storage.setItem(SELECTED_ROOM_STORAGE_KEY, normalizedSlug);
};

export const redirectToSavedRoom = (
  pageKind: RoomPageKind,
  pathname: string,
  location: Pick<Location, "replace">,
  storage: Storage
): boolean => {
  if (pathname.startsWith("/rooms/")) {
    return false;
  }

  const slug = savedRoomSlug(storage);
  if (slug === DEFAULT_ROOM_SLUG) {
    return false;
  }

  location.replace(roomPagePath(slug, pageKind));
  return true;
};

export const renderRoomOptions = (
  selectElement: HTMLSelectElement,
  rooms: RoomInfo[],
  selectedSlug: string
): void => {
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "选择房间";
  placeholder.disabled = selectedSlug !== DEFAULT_ROOM_SLUG;

  const options = rooms.map((room) => {
    const option = document.createElement("option");
    option.value = room.slug;
    option.textContent = room.name;
    return option;
  });

  selectElement.replaceChildren(placeholder, ...options);
  selectElement.value = rooms.some((room) => room.slug === selectedSlug) ? selectedSlug : "";
};
