import { createServer, type Server } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpRequestLogger } from "../logging/HttpRequestLogger";
import { ServerLogger } from "../logging/ServerLogger";

const listen = async (app: express.Express) => {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected TCP server address");
  }
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
};

describe("ServerLogger", () => {
  const tempDirs: string[] = [];
  let server: Server | null = null;

  afterEach(async () => {
    vi.restoreAllMocks();
    if (server) {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
      server = null;
    }
    await Promise.all(tempDirs.map((directory) => rm(directory, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  const createLogPath = async () => {
    const directory = await mkdtemp(join(tmpdir(), "stream-charge-log-"));
    tempDirs.push(directory);
    return join(directory, "server.log");
  };

  it("writes UTF-8 logs with a BOM and redacts sensitive fields", async () => {
    const logFilePath = await createLogPath();
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const logger = new ServerLogger({ logFilePath });

    logger.info("auth", "登录成功", {
      roomName: "温柔房",
      password: "secret-password",
      cookie: "session=secret",
      avatarDataUrl: "data:image/png;base64,AAAA"
    });

    const bytes = readFileSync(logFilePath);
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);

    const text = bytes.toString("utf8");
    expect(text).toContain("INFO [auth] 登录成功");
    expect(text).toContain("温柔房");
    expect(text).toContain("[redacted]");
    expect(text).not.toContain("secret-password");
    expect(text).not.toContain("session=secret");
    expect(text).not.toContain("data:image/png");
    expect(info).toHaveBeenCalledWith(expect.stringContaining("INFO [auth] 登录成功"));
  });

  it("does not throw when the log file cannot be written", async () => {
    const directoryPath = await createLogPath();
    await rm(directoryPath, { force: true });
    const logger = new ServerLogger({ logFilePath: join(directoryPath, "missing", "server.log") });

    expect(() => logger.info("server", "启动日志", { port: 3000 })).not.toThrow();
    expect(existsSync(join(directoryPath, "missing", "server.log"))).toBe(true);

    const unwritableLogger = new ServerLogger({ logFilePath: directoryPath });
    expect(() => unwritableLogger.error("server", "写入失败", { errorMessage: "EISDIR" })).not.toThrow();
  });

  it("logs API and page HTTP requests with status and duration", async () => {
    const entries: string[] = [];
    const logger = {
      info(module: string, message: string, details?: Record<string, unknown>) {
        entries.push(JSON.stringify({ module, message, details }));
      },
      warn() {},
      error() {}
    };
    const app = express();
    app.use(createHttpRequestLogger(logger));
    app.get("/api/state", (_request, response) => response.json({ ok: true }));
    app.get("/src/client.js", (_request, response) => response.send("ignored"));
    const running = await listen(app);
    server = running.server;

    await fetch(`${running.baseUrl}/api/state`);
    await fetch(`${running.baseUrl}/src/client.js`);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toContain('"module":"http"');
    expect(entries[0]).toContain('"method":"GET"');
    expect(entries[0]).toContain('"/api/state"');
    expect(entries[0]).toContain('"statusCode":200');
    expect(entries[0]).toContain('"durationMs"');
  });
});
