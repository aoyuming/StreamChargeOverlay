import "./styles/admin.css";
import { ApiClient } from "./common/ApiClient";
import { RealtimeClient } from "./common/RealtimeClient";
import { AdminApp } from "./admin/AdminApp";

const app = new AdminApp(new ApiClient(), new RealtimeClient());
await app.start();
