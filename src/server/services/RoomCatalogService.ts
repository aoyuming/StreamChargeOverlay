import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { CreateRoomRequest, RoomInfo } from "../../shared/types";
import { normalizeRoomSlug } from "../../shared/RoomSlug";
import { SqliteRoomStateRepository } from "../repositories/SqliteRoomStateRepository";

type RoomRow = {
  slug: string;
  name: string;
  created_at: number;
};

type RoomPasswordRow = {
  viewer_password_hash: string | null;
  viewer_password_salt: string | null;
};

const PASSWORD_KEY_LENGTH = 32;
const PASSWORD_SALT_LENGTH = 16;

export class RoomCatalogService {
  public constructor(
    private readonly databasePath: string,
    private readonly defaultViewerPassword: string
  ) {}

  public listRooms(): RoomInfo[] {
    const database = this.prepareDatabase();
    const rows = database
      .prepare(
        `
        SELECT slug, name, created_at
        FROM rooms
        WHERE deleted_at IS NULL AND slug <> 'default'
        ORDER BY
          CASE slug
            WHEN 'wenrou' THEN 0
            WHEN 'liyong' THEN 1
            WHEN 'room-59' THEN 2
            ELSE 3
          END,
          created_at ASC
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

    const database = this.prepareDatabase();
    const now = Date.now();
    const slug = this.uniqueSlug(database, name);
    const password = this.hashPassword(this.defaultViewerPassword);
    database
      .prepare(
        `
        INSERT INTO rooms (
          id, slug, name, created_at, updated_at, viewer_password_hash, viewer_password_salt, deleted_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
      `
      )
      .run(randomUUID(), slug, name, now, now, password.hash, password.salt);

    return { slug, name, createdAt: now };
  }

  public deleteRoom(slug: string): RoomInfo[] {
    const normalizedSlug = normalizeRoomSlug(slug);
    if (normalizedSlug === "default") {
      throw new Error("默认兼容房间不能删除");
    }

    const database = this.prepareDatabase();
    database
      .prepare("UPDATE rooms SET deleted_at = ?, updated_at = ? WHERE slug = ?")
      .run(Date.now(), Date.now(), normalizedSlug);

    return this.listRooms();
  }

  public matchesViewerPassword(roomSlug: string, password: string): boolean {
    if (!password) {
      return false;
    }

    const row = this.prepareDatabase()
      .prepare(
        `
        SELECT viewer_password_hash, viewer_password_salt
        FROM rooms
        WHERE slug = ? AND deleted_at IS NULL
      `
      )
      .get(normalizeRoomSlug(roomSlug)) as RoomPasswordRow | undefined;

    if (!row?.viewer_password_hash || !row.viewer_password_salt) {
      return false;
    }

    return this.verifyPassword(password, row.viewer_password_hash, row.viewer_password_salt);
  }

  public updateViewerPassword(roomSlug: string, password: string): void {
    const normalizedSlug = normalizeRoomSlug(roomSlug);
    const nextPassword = password.trim();
    if (!nextPassword) {
      throw new Error("普通密码不能为空");
    }

    const hashed = this.hashPassword(nextPassword);
    const result = this.prepareDatabase()
      .prepare(
        `
        UPDATE rooms
        SET viewer_password_hash = ?, viewer_password_salt = ?, updated_at = ?
        WHERE slug = ? AND deleted_at IS NULL
      `
      )
      .run(hashed.hash, hashed.salt, Date.now(), normalizedSlug);

    if (result.changes === 0) {
      throw new Error("房间不存在");
    }
  }

  private prepareDatabase(): ReturnType<typeof SqliteRoomStateRepository.prepareDatabase> {
    const database = SqliteRoomStateRepository.prepareDatabase(this.databasePath);
    this.ensureRoomPasswords(database);
    return database;
  }

  private ensureRoomPasswords(database: ReturnType<typeof SqliteRoomStateRepository.prepareDatabase>): void {
    const rows = database
      .prepare(
        `
        SELECT slug
        FROM rooms
        WHERE viewer_password_hash IS NULL OR viewer_password_salt IS NULL
      `
      )
      .all() as Array<{ slug: string }>;

    const updatePassword = database.prepare(
      `
      UPDATE rooms
      SET viewer_password_hash = ?, viewer_password_salt = ?, updated_at = ?
      WHERE slug = ?
    `
    );

    for (const row of rows) {
      const hashed = this.hashPassword(this.defaultViewerPassword);
      updatePassword.run(hashed.hash, hashed.salt, Date.now(), row.slug);
    }
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

  private hashPassword(password: string): { hash: string; salt: string } {
    const salt = randomBytes(PASSWORD_SALT_LENGTH).toString("base64url");
    return {
      salt,
      hash: scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString("base64url")
    };
  }

  private verifyPassword(password: string, expectedHash: string, salt: string): boolean {
    const actual = scryptSync(password, salt, PASSWORD_KEY_LENGTH);
    const expected = Buffer.from(expectedHash, "base64url");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
