import { mkdtemp, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import express from "express";
import { afterEach, describe, expect, it } from "vitest";
import { registerFrontendRoutes } from "../frontendRoutes";

describe("frontend routes", () => {
  let server: Server | null = null;

  afterEach(async () => {
    if (!server) {
      return;
    }

    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = null;
  });

  it("serves built pages through room-scoped routes in production mode", async () => {
    const clientDirectory = await mkdtemp(join(tmpdir(), "sponsor-client-dist-"));
    await writeFile(join(clientDirectory, "display.html"), "<html><title>display production</title></html>");
    await writeFile(join(clientDirectory, "overlay.html"), "<html><title>overlay production</title></html>");
    await writeFile(join(clientDirectory, "admin.html"), "<html><title>admin production</title></html>");

    const app = express();
    const httpServer = createServer(app);
    await registerFrontendRoutes({
      app,
      clientDirectory,
      httpServer,
      isProduction: true
    });
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    server = httpServer;
    const address = httpServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected TCP server address");
    }
    const baseUrl = `http://127.0.0.1:${address.port}`;

    await expect((await fetch(`${baseUrl}/rooms/alpha/display.html`)).text()).resolves.toContain("display production");
    await expect((await fetch(`${baseUrl}/rooms/alpha/overlay.html`)).text()).resolves.toContain("overlay production");
    await expect((await fetch(`${baseUrl}/rooms/alpha/admin.html`)).text()).resolves.toContain("admin production");
  });

  it("has an npm start script for running the production server", async () => {
    const packageJson = (await import("node:fs/promises")
      .then(({ readFile }) => readFile(resolve(process.cwd(), "package.json"), "utf8"))
      .then(JSON.parse)) as { scripts: Record<string, string> };

    expect(packageJson.scripts.start).toBe("tsx src/server/main.ts");
  });
});
