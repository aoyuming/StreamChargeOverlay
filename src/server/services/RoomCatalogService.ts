import { randomUUID } from "node:crypto";
import type { CreateRoomRequest, RoomInfo } from "../../shared/types";
import { normalizeRoomSlug } from "../../shared/RoomSlug";
import { SqliteRoomStateRepository } from "../repositories/SqliteRoomStateRepository";

type RoomRow = {
  slug: string;
  name: string;
  created_at: number;
};

export class RoomCatalogService {
  public constructor(private readonly databasePath: string) {}

  public listRooms(): RoomInfo[] {
    const database = SqliteRoomStateRepository.prepareDatabase(this.databasePath);
    const rows = database
      .prepare(
        `
        SELECT slug, name, created_at
        FROM rooms
        WHERE deleted_at IS NULL AND slug <> 'default'
        ORDER BY created_at ASC
      `
      )
      .all() as RoomRow[];

    return rows.map((row) => this.toRoomInfo(row));
  }

  public createRoom(request: CreateRoomRequest): RoomInfo {
    const name = request.name.trim();
    if (!name) {
      throw new Error("房间名不能为空");
    }

    const database = SqliteRoomStateRepository.prepareDatabase(this.databasePath);
    const now = Date.now();
    const slug = this.uniqueSlug(database, name);
    database
      .prepare(
        `
        INSERT INTO rooms (id, slug, name, created_at, updated_at, deleted_at)
        VALUES (?, ?, ?, ?, ?, NULL)
      `
      )
      .run(randomUUID(), slug, name, now, now);

    return { slug, name, createdAt: now };
  }

  public deleteRoom(slug: string): RoomInfo[] {
    const normalizedSlug = normalizeRoomSlug(slug);
    if (normalizedSlug === "default") {
      throw new Error("默认兼容房间不能删除");
    }

    const database = SqliteRoomStateRepository.prepareDatabase(this.databasePath);
    database
      .prepare("UPDATE rooms SET deleted_at = ?, updated_at = ? WHERE slug = ?")
      .run(Date.now(), Date.now(), normalizedSlug);

    return this.listRooms();
  }

  private uniqueSlug(database: ReturnType<typeof SqliteRoomStateRepository.prepareDatabase>, name: string): string {
    const asciiBase = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const base = normalizeRoomSlug(asciiBase, this.randomRoomSlug());
    let slug = base;
    let counter = 2;

    while (this.slugExists(database, slug)) {
      slug = normalizeRoomSlug(`${base}-${counter}`, this.randomRoomSlug());
      counter += 1;
    }

    return slug;
  }

  private slugExists(
    database: ReturnType<typeof SqliteRoomStateRepository.prepareDatabase>,
    slug: string
  ): boolean {
    const row = database.prepare("SELECT slug FROM rooms WHERE slug = ?").get(slug);
    return Boolean(row);
  }

  private randomRoomSlug(): string {
    return `room-${randomUUID().replace(/-/g, "").slice(0, 6)}`;
  }

  private toRoomInfo(row: RoomRow): RoomInfo {
    return {
      slug: row.slug,
      name: row.name,
      createdAt: row.created_at
    };
  }
}
