import type { NextFunction, Request, Response } from "express";
import type { ServerLogSink } from "./ServerLogger";

export const createHttpRequestLogger = (logger: ServerLogSink) => {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (!shouldLogHttpRequest(request.path)) {
      next();
      return;
    }

    const start = process.hrtime.bigint();
    response.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      logger.info("http", `${request.method} ${request.path} ${response.statusCode} ${Math.round(durationMs)}ms`, {
        method: request.method,
        path: request.path,
        statusCode: response.statusCode,
        durationMs: Math.round(durationMs)
      });
    });
    next();
  };
};

const shouldLogHttpRequest = (path: string): boolean => {
  if (path === "/" || path.endsWith(".html")) {
    return true;
  }

  if (path.startsWith("/api/")) {
    return true;
  }

  return /^\/rooms\/[^/]+\/api\//.test(path);
};
