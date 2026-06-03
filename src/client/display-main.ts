import "./styles/display.css";
import { ApiClient } from "./common/ApiClient";
import { RealtimeClient } from "./common/RealtimeClient";
import { RoomContext } from "./common/RoomContext";
import { DisplayApp } from "./display/DisplayApp";
import { DisplayStageScaler } from "./display/DisplayStageScaler";

new DisplayStageScaler(document.documentElement, window).start();
const roomContext = RoomContext.fromPath(window.location.pathname);
const app = new DisplayApp(new ApiClient(roomContext), new RealtimeClient(roomContext));
await app.start();
