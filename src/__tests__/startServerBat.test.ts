import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("start-server.bat", () => {
  const scriptPath = resolve(process.cwd(), "start-server.bat");

  it("starts the local StreamCharge server from the project directory", () => {
    expect(existsSync(scriptPath)).toBe(true);

    const script = readFileSync(scriptPath, "utf8");

    expect(script).toContain("chcp 65001 >nul");
    expect(script).toContain('cd /d "%~dp0"');
    expect(script).toContain('if not exist "package.json"');
    expect(script).toContain('if not exist "node_modules"');
    expect(script).toContain("data\\server.log");
    expect(script).toContain("http://localhost:3000/admin.html");
    expect(script).toContain("http://localhost:3000/overlay.html");
    expect(script).toContain("http://localhost:3000/display.html");
    expect(script).toContain("call npm.cmd run dev");
  });
});
