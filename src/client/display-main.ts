import "./styles/display.css";
import { ApiClient } from "./common/ApiClient";
import { RealtimeClient } from "./common/RealtimeClient";
import { DisplayApp } from "./display/DisplayApp";

const app = new DisplayApp(new ApiClient(), new RealtimeClient());
await app.start();
