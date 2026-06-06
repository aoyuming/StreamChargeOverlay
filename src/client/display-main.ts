import "./styles/display.css";
import { ApiClient } from "./common/ApiClient";
import { queryRequired } from "./common/dom";
import { RealtimeClient } from "./common/RealtimeClient";
import { RoomContext } from "./common/RoomContext";
import {
  fixedPagePath,
  nextRoomSlug,
  preferredRoomSlug,
  rememberRoomSlug,
  renderRoomOptions,
  savedRoomSlug
} from "./common/RoomSelection";
import { DisplayApp } from "./display/DisplayApp";
import { DisplayStageScaler } from "./display/DisplayStageScaler";

new DisplayStageScaler(document.documentElement, window).start();

const roomContext = RoomContext.fromPath(window.location.pathname);
const roomSelect = queryRequired<HTMLSelectElement>("#roomSelect");
const roomCycleButton = queryRequired<HTMLButtonElement>("#roomCycleButton");
const adminOpenButton = queryRequired<HTMLAnchorElement>("#adminOpenButton");
const rooms = await new ApiClient(roomContext).getRooms();
const selectedSlug = preferredRoomSlug(rooms, roomContext.slug, savedRoomSlug(window.localStorage));
let activeRoomSlug = selectedSlug;

rememberRoomSlug(window.localStorage, selectedSlug);
renderDisplayRoomControls(selectedSlug);
adminOpenButton.href = fixedPagePath("admin");

const app = new DisplayApp(apiClientForRoom(selectedSlug), realtimeClientForRoom(selectedSlug));

roomCycleButton.addEventListener("click", () => {
  const slug = nextRoomSlug(rooms, activeRoomSlug);
  if (slug === "default") {
    return;
  }

  void switchDisplayRoom(slug);
});

roomSelect.addEventListener("change", () => {
  const slug = roomSelect.value;
  if (!slug) {
    return;
  }

  void switchDisplayRoom(slug);
});

await app.start();

function apiClientForRoom(roomSlug: string): ApiClient {
  return new ApiClient(new RoomContext(roomSlug));
}

function realtimeClientForRoom(roomSlug: string): RealtimeClient {
  return new RealtimeClient(new RoomContext(roomSlug));
}

function renderDisplayRoomControls(selectedSlug: string): void {
  renderRoomOptions(roomSelect, rooms, selectedSlug);
  const selectedRoom = rooms.find((room) => room.slug === selectedSlug);
  roomCycleButton.textContent = selectedRoom ? `房间：${selectedRoom.name}` : "选择房间";
}

async function switchDisplayRoom(slug: string): Promise<void> {
  if (!rooms.some((room) => room.slug === slug)) {
    return;
  }

  activeRoomSlug = slug;
  rememberRoomSlug(window.localStorage, slug);
  renderDisplayRoomControls(slug);
  await app.switchDataSource(apiClientForRoom(slug), realtimeClientForRoom(slug));
}
