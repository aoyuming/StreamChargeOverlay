import { createServer } from "node:http";
import { resolve } from "node:path";
import express from "express";
import { Server as SocketServer } from "socket.io";
import { normalizeRoomSlug } from "../shared/RoomSlug";
import { AppConfig } from "./config/AppConfig";
import { ApiController } from "./controllers/ApiController";
import { registerFrontendRoutes } from "./frontendRoutes";
import { SqliteRoomStateRepositoryFactory } from "./repositories/RoomStateRepositoryFactory";
import { AuthService } from "./services/AuthService";
import { AvatarService } from "./services/AvatarService";
import { DonationService } from "./services/DonationService";
import { RealtimeHub } from "./services/RealtimeHub";
import { RoomCatalogService } from "./services/RoomCatalogService";
import { WindowsSpeechService } from "./services/WindowsSpeechService";

const config = AppConfig.fromEnv();

const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer);

const legacyJsonPath = resolve(config.dataDirectory, "demo-state.json");
const repositoryFactory = new SqliteRoomStateRepositoryFactory(config.databasePath, legacyJsonPath);
const realtimeHub = new RealtimeHub(io);
const speechDirectory = resolve(config.dataDirectory, "speech");
const speechService = new WindowsSpeechService(speechDirectory);
const avatarDirectory = resolve(config.dataDirectory, "avatars");
const avatarService = new AvatarService(avatarDirectory);
const authService = new AuthService({
  adminPassword: config.adminPassword,
  sessionSecret: config.sessionSecret,
  viewerPassword: config.viewerPassword
});
const roomCatalog = new RoomCatalogService(config.databasePath, config.viewerPassword);
const apiController = new ApiController(
  repositoryFactory,
  realtimeHub,
  speechService,
  config.defaultRoomSlug,
  authService,
  roomCatalog,
  avatarService
);

app.use(express.json({ limit: "1mb" }));
app.use("/speech", express.static(speechDirectory));
app.use("/avatars", express.static(avatarDirectory));
apiController.register(app);

io.on("connection", async (socket) => {
  const rawRoomSlug = typeof socket.handshake.query.roomSlug === "string" ? socket.handshake.query.roomSlug : "";
  const roomSlug = normalizeRoomSlug(rawRoomSlug, config.defaultRoomSlug);
  socket.join(roomSlug);

  const donationService = new DonationService(await repositoryFactory.getRepository(roomSlug));
  realtimeHub.sendInitialState(socket.id, await donationService.getState());
});

// Room-scoped pages reuse the same frontend entries. In production the server
// serves dist/client; in development Vite keeps hot reload wired into HTTP.
await registerFrontendRoutes({
  app,
  httpServer,
  isProduction: config.isProduction
});

httpServer.listen(config.port, () => {
  console.log(`OBS overlay page: http://localhost:${config.port}/overlay.html`);
  console.log(`Display page: http://localhost:${config.port}/display.html`);
  console.log(`Admin page: http://localhost:${config.port}/admin.html`);
});
