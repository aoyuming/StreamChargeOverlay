import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SqliteRoomStateRepository } from "../repositories/SqliteRoomStateRepository";
import { RoomCatalogService } from "../services/RoomCatalogService";

const tempFiles: string[] = [];

const createDatabasePath = async () => {
  const directory = await mkdtemp(join(tmpdir(), "sponsor-room-catalog-"));
  const databasePath = join(directory, "app.sqlite");
  tempFiles.push(databasePath);
  return databasePath;
};

describe("RoomCatalogService", () => {
  afterEach(() => {
    for (const filePath of tempFiles.splice(0)) {
      SqliteRoomStateRepository.closeDatabase(filePath);
    }
  });

  it("seeds default rooms, creates new rooms, and soft-deletes rooms", async () => {
    const service = new RoomCatalogService(await createDatabasePath(), "legacy-viewer-password");

    expect(service.listRooms().map((room) => [room.slug, room.name])).toEqual([
      ["wenrou", "温柔房"],
      ["liyong", "李永房"],
      ["room-59", "59房"]
    ]);

    const created = service.createRoom({ name: "测试房" });
    expect(created.name).toBe("测试房");
    expect(created.slug).toMatch(/^room-/);
    expect(service.listRooms().map((room) => room.slug)).toContain(created.slug);

    service.deleteRoom(created.slug);
    expect(service.listRooms().map((room) => room.slug)).not.toContain(created.slug);
  });

  it("matches and updates room viewer passwords without exposing plaintext", async () => {
    const service = new RoomCatalogService(await createDatabasePath(), "legacy-viewer-password");

    expect(service.matchesViewerPassword("wenrou", "legacy-viewer-password")).toBe(true);
    expect(service.matchesViewerPassword("liyong", "wrong-password")).toBe(false);

    service.updateViewerPassword("wenrou", "next-viewer-password");

    expect(service.matchesViewerPassword("wenrou", "legacy-viewer-password")).toBe(false);
    expect(service.matchesViewerPassword("wenrou", "next-viewer-password")).toBe(true);
    expect(service.listRooms()[0]).not.toHaveProperty("viewerPassword");
  });
});
