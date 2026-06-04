import "./styles/display.css";
import { ApiClient } from "./common/ApiClient";
import { queryRequired } from "./common/dom";
import { RealtimeClient } from "./common/RealtimeClient";
import { RoomContext } from "./common/RoomContext";
import { redirectToSavedRoom, rememberRoomSlug, renderRoomOptions, roomPagePath } from "./common/RoomSelection";
import { DisplayApp } from "./display/DisplayApp";
import { DisplayStageScaler } from "./display/DisplayStageScaler";

new DisplayStageScaler(document.documentElement, window).start();

const redirected = redirectToSavedRoom("display", window.location.pathname, window.location, window.localStorage);
if (!redirected) {
  const roomContext = RoomContext.fromPath(window.location.pathname);
  const apiClient = new ApiClient(roomContext);
  const roomSelect = queryRequired<HTMLSelectElement>("#roomSelect");

  if (roomContext.slug !== "default") {
    rememberRoomSlug(window.localStorage, roomContext.slug);
  }

  roomSelect.addEventListener("change", () => {
    const slug = roomSelect.value;
    if (!slug) {
      return;
    }

    rememberRoomSlug(window.localStorage, slug);
    window.location.href = roomPagePath(slug, "display");
  });

  renderRoomOptions(roomSelect, await apiClient.getRooms(), roomContext.slug);

  const app = new DisplayApp(apiClient, new RealtimeClient(roomContext));
  await app.start();
}
