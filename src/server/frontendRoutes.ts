import { existsSync } from "node:fs";
import type { Server } from "node:http";
import { resolve } from "node:path";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { createServer as createViteServer } from "vite";

type FrontendRouteOptions = {
  app: Express;
  httpServer: Server;
  isProduction: boolean;
  clientDirectory?: string;
};

export const DEFAULT_CLIENT_DIRECTORY = resolve(process.cwd(), "dist/client");

export const registerFrontendRoutes = async ({
  app,
  clientDirectory = DEFAULT_CLIENT_DIRECTORY,
  httpServer,
  isProduction
}: FrontendRouteOptions): Promise<void> => {
  app.get("/rooms/:roomSlug/display.html", rewriteTo("/display.html"));
  app.get("/rooms/:roomSlug/admin.html", rewriteTo("/admin.html"));

  if (isProduction) {
    if (!existsSync(clientDirectory)) {
      console.warn(`Production client directory is missing. Run npm run build first: ${clientDirectory}`);
    }

    app.use(express.static(clientDirectory));
    app.get("/", (_request, response) => response.redirect("/display.html"));
    return;
  }

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
};

const rewriteTo = (path: string) => {
  return (request: Request, _response: Response, next: NextFunction): void => {
    request.url = path;
    next();
  };
};
