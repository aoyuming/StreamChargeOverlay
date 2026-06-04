import "./styles/display.css";
import { ApiClient } from "./common/ApiClient";
import { queryRequired } from "./common/dom";
import { RealtimeClient } from "./common/RealtimeClient";
import { RoomContext } from "./common/RoomContext";
import {
  nextRoomSlug,
  preferredRoomSlug,
  rememberRoomSlug,
  renderRoomOptions,
  roomPagePath,
  savedRoomSlug
} from "./common/RoomSelection";
import { DisplayApp } from "./display/DisplayApp";
import { DisplayStageScaler } from "./display/DisplayStageScaler";

new DisplayStageScaler(document.documentElement, window).start();

const roomContext = RoomContext.fromPath(window.location.pathname);
const apiClient = new ApiClient(roomContext);
const roomSelect = queryRequired<HTMLSelectElement>("#roomSelect");
const roomCycleButton = queryRequired<HTMLButtonElement>("#roomCycleButton");
const adminOpenButton = queryRequired<HTMLAnchorElement>("#adminOpenButton");
const rooms = await apiClient.getRooms();
const selectedSlug = preferredRoomSlug(rooms, roomContext.slug, savedRoomSlug(window.localStorage));

if (selectedSlug !== roomContext.slug && selectedSlug !== "default") {
  rememberRoomSlug(window.localStorage, selectedSlug);
  window.location.replace(roomPagePath(selectedSlug, "display"));
} else {
  rememberRoomSlug(window.localStorage, selectedSlug);
  renderRoomOptions(roomSelect, rooms, selectedSlug);
  const selectedRoom = rooms.find((room) => room.slug === selectedSlug);
  roomCycleButton.textContent = selectedRoom ? `房间：${selectedRoom.name}` : "选择房间";
  adminOpenButton.href = roomPagePath(selectedSlug, "admin");

  roomCycleButton.addEventListener("click", () => {
    const slug = nextRoomSlug(rooms, roomSelect.value || selectedSlug);
    if (slug === "default") {
      return;
    }

    rememberRoomSlug(window.localStorage, slug);
    window.location.href = roomPagePath(slug, "display");
  });

  roomSelect.addEventListener("change", () => {
    const slug = roomSelect.value;
    if (!slug) {
      return;
    }

    rememberRoomSlug(window.localStorage, slug);
    window.location.href = roomPagePath(slug, "display");
  });

  const app = new DisplayApp(apiClient, new RealtimeClient(roomContext));
  await app.start();
}
