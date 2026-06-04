import "./styles/admin.css";
import { ApiClient } from "./common/ApiClient";
import { RealtimeClient } from "./common/RealtimeClient";
import { RoomContext } from "./common/RoomContext";
import { redirectToSavedRoom } from "./common/RoomSelection";
import { AdminApp } from "./admin/AdminApp";

const redirected = redirectToSavedRoom("admin", window.location.pathname, window.location, window.localStorage);
if (!redirected) {
  const roomContext = RoomContext.fromPath(window.location.pathname);
  const app = new AdminApp(new ApiClient(roomContext), new RealtimeClient(roomContext));
  await app.start();
}
