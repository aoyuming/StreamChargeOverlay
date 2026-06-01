import { createServer } from "node:http";
import { resolve } from "node:path";
import express from "express";
import { Server as SocketServer } from "socket.io";
import { createServer as createViteServer } from "vite";
import { ApiController } from "./controllers/ApiController";
import { JsonStateRepository } from "./repositories/JsonStateRepository";
import { DonationService } from "./services/DonationService";
import { RealtimeHub } from "./services/RealtimeHub";
import { WindowsSpeechService } from "./services/WindowsSpeechService";

const PORT = 3000;

const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer);

const repository = new JsonStateRepository(resolve(process.cwd(), "data", "demo-state.json"));
const donationService = new DonationService(repository);
const realtimeHub = new RealtimeHub(io);
const speechDirectory = resolve(process.cwd(), "data", "speech");
const speechService = new WindowsSpeechService(speechDirectory);
const apiController = new ApiController(donationService, realtimeHub, speechService);

app.use(express.json());
app.use("/speech", express.static(speechDirectory));
apiController.register(app);

io.on("connection", async (socket) => {
  const state = await donationService.getState();
  realtimeHub.sendInitialState(socket.id, state);
});

// Vite 作为 Express 中间件运行，让本地 demo 只需要启动一个 3000 端口。
const vite = await createViteServer({
  appType: "mpa",
  server: {
    middlewareMode: true,
    hmr: {
      server: httpServer
    }
  }
});

app.use(vite.middlewares);

httpServer.listen(PORT, () => {
  console.log(`赞助榜 demo 已启动: http://localhost:${PORT}/display.html`);
  console.log(`后台管理页面: http://localhost:${PORT}/admin.html`);
});
