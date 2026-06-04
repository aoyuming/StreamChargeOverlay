import { access, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { AvatarService } from "../services/AvatarService";

describe("AvatarService", () => {
  it("saves and clears avatar data under a room directory", async () => {
    const directory = await mkdtemp(join(tmpdir(), "sponsor-avatars-"));
    const service = new AvatarService(directory);

    const url = await service.saveAvatar("alpha", "sponsor-1", "data:image/webp;base64,YXZhdGFy");
    const filePath = join(directory, "alpha", "sponsor-1.webp");

    expect(url).toBe("/avatars/alpha/sponsor-1.webp");
    expect(await readFile(filePath, "utf8")).toBe("avatar");

    await service.clearAvatar(url);

    await expect(access(filePath)).rejects.toThrow();
  });

  it("rejects unsupported avatar data URLs", async () => {
    const directory = await mkdtemp(join(tmpdir(), "sponsor-avatars-"));
    const service = new AvatarService(directory);

    await expect(service.saveAvatar("alpha", "sponsor-1", "data:text/plain;base64,YXZhdGFy")).rejects.toThrow(
      "头像图片格式不正确"
    );
  });
});
