import { appendFileSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { EOL } from "node:os";

export type ServerLogLevel = "INFO" | "WARN" | "ERROR";

export type ServerLogDetails = Record<string, unknown>;

export interface ServerLogSink {
  info(module: string, message: string, details?: ServerLogDetails): void;
  warn(module: string, message: string, details?: ServerLogDetails): void;
  error(module: string, message: string, details?: ServerLogDetails): void;
}

interface ServerLoggerOptions {
  logFilePath: string;
  consoleSink?: Pick<Console, "info" | "warn" | "error">;
}

const REDACTED = "[redacted]";
const MAX_STRING_LENGTH = 800;

export class ServerLogger implements ServerLogSink {
  private readonly consoleSink: Pick<Console, "info" | "warn" | "error">;
  private didWarnAboutFileWrite = false;

  public constructor(public readonly options: ServerLoggerOptions) {
    this.consoleSink = options.consoleSink ?? console;
  }

  public get logFilePath(): string {
    return this.options.logFilePath;
  }

  public info(module: string, message: string, details?: ServerLogDetails): void {
    this.write("INFO", module, message, details);
  }

  public warn(module: string, message: string, details?: ServerLogDetails): void {
    this.write("WARN", module, message, details);
  }

  public error(module: string, message: string, details?: ServerLogDetails): void {
    this.write("ERROR", module, message, details);
  }

  private write(level: ServerLogLevel, module: string, message: string, details?: ServerLogDetails): void {
    const line = this.formatLine(level, module, message, details);
    this.writeConsole(level, line);
    this.writeFile(line);
  }

  private formatLine(level: ServerLogLevel, module: string, message: string, details?: ServerLogDetails): string {
    const base = `[${this.localTimestamp(new Date())}] ${level} [${module}] ${message}`;
    if (!details || Object.keys(details).length === 0) {
      return base;
    }

    return `${base} ${this.stringifyDetails(details)}`;
  }

  private stringifyDetails(details: ServerLogDetails): string {
    try {
      return JSON.stringify(this.sanitizeValue(details));
    } catch (error) {
      return JSON.stringify({
        serializationError: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private sanitizeValue(value: unknown, key = ""): unknown {
    if (this.isSensitiveKey(key)) {
      return REDACTED;
    }

    if (typeof value === "string") {
      if (value.startsWith("data:image/")) {
        return REDACTED;
      }
      return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}...` : value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeValue(item));
    }

    if (value && typeof value === "object") {
      const output: ServerLogDetails = {};
      for (const [entryKey, entryValue] of Object.entries(value)) {
        output[entryKey] = this.sanitizeValue(entryValue, entryKey);
      }
      return output;
    }

    return value;
  }

  private isSensitiveKey(key: string): boolean {
    return /password|cookie|authorization|session|avatarDataUrl/i.test(key);
  }

  private writeConsole(level: ServerLogLevel, line: string): void {
    if (level === "ERROR") {
      this.consoleSink.error(line);
      return;
    }

    if (level === "WARN") {
      this.consoleSink.warn(line);
      return;
    }

    this.consoleSink.info(line);
  }

  private writeFile(line: string): void {
    try {
      this.ensureLogFile();
      appendFileSync(this.options.logFilePath, `${line}${EOL}`, { encoding: "utf8" });
    } catch (error) {
      if (this.didWarnAboutFileWrite) {
        return;
      }

      this.didWarnAboutFileWrite = true;
      this.consoleSink.warn(
        `[${this.localTimestamp(new Date())}] WARN [logger] failed to write log file ${JSON.stringify({
          logFilePath: this.options.logFilePath,
          errorMessage: error instanceof Error ? error.message : String(error)
        })}`
      );
    }
  }

  private ensureLogFile(): void {
    mkdirSync(dirname(this.options.logFilePath), { recursive: true });

    if (!existsSync(this.options.logFilePath) || statSync(this.options.logFilePath).size === 0) {
      writeFileSync(this.options.logFilePath, "\uFEFF", { encoding: "utf8" });
    }
  }

  private localTimestamp(date: Date): string {
    const pad = (value: number, length = 2) => String(value).padStart(length, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
      date.getMinutes()
    )}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
  }
}
