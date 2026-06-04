import { mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import type { AppState, SponsorRecord, StateRepository } from "../../shared/types";

const DEFAULT_TARGET_AMOUNT = 1000;
const DEFAULT_SLOGAN = "赞助点将，名场面马上开演";

const DEFAULT_ROOMS = [
  { slug: "wenrou", name: "温柔房" },
  { slug: "liyong", name: "李永房" },
  { slug: "room-59", name: "59房" }
] as const;

type RepositoryOptions = {
  legacyJsonPath?: string;
};

type RoomRow = {
  id: string;
};

type SettingsRow = {
  target_amount: number;
  slogan: string;
  charge_consumed_amount: number;
  last_dianjiang_effect_at: number | null;
};

type SponsorRow = {
  id: string;
  boss_name: string;
  amount: number;
  program_name: string;
  note: string;
  counts_toward_charge: number;
  avatar_url: string | null;
  hidden_from_today_at: number | null;
  created_at: number;
};

// SQLite-backed room repository. Each instance is scoped to one room, while the
// shared database keeps all rooms in one deployable file.
export class SqliteRoomStateRepository implements StateRepository {
  private static readonly databases = new Map<string, Database.Database>();

  private constructor(
    private readonly database: Database.Database,
    private readonly roomSlug: string,
    private readonly roomId: string
  ) {}

  public static async open(
    databasePath: string,
    roomSlug: string,
    options: RepositoryOptions = {}
  ): Promise<SqliteRoomStateRepository> {
    await mkdir(dirname(databasePath), { recursive: true });

    const database = this.prepareDatabase(databasePath);
    const roomId = this.ensureRoom(database, roomSlug);
    const repository = new SqliteRoomStateRepository(database, roomSlug, roomId);
    await repository.migrateLegacyJsonIfNeeded(options.legacyJsonPath);
    return repository;
  }

  public static closeDatabase(databasePath: string): void {
    const database = this.databases.get(databasePath);
    if (!database) {
      return;
    }

    database.close();
    this.databases.delete(databasePath);
  }

  public static prepareDatabase(databasePath: string): Database.Database {
    const database = this.getDatabase(databasePath);
    this.initializeSchema(database);
    this.ensureDefaultRooms(database);
    return database;
  }

  public async load(): Promise<AppState> {
    const settings = this.loadSettings();
    const sponsors = this.database
      .prepare(
        `
        SELECT id, boss_name, amount, program_name, note, counts_toward_charge, avatar_url, hidden_from_today_at, created_at
        FROM sponsor_records
        WHERE room_id = ?
        ORDER BY created_at ASC
      `
      )
      .all(this.roomId) as SponsorRow[];

    return {
      targetAmount: settings.target_amount,
      slogan: settings.slogan,
      chargeConsumedAmount: settings.charge_consumed_amount,
      lastDianjiangEffectAt: settings.last_dianjiang_effect_at ?? undefined,
      sponsors: sponsors.map((row) => ({
        id: row.id,
        bossName: row.boss_name,
        amount: row.amount,
        programName: row.program_name,
        note: row.note,
        countsTowardCharge: row.counts_toward_charge === 1,
        avatarUrl: row.avatar_url ?? undefined,
        hiddenFromTodayAt: row.hidden_from_today_at ?? undefined,
        createdAt: row.created_at
      }))
    };
  }

  public async save(state: AppState): Promise<void> {
    const saveState = this.database.transaction((nextState: AppState) => {
      this.database
        .prepare(
          `
          INSERT INTO room_settings (room_id, target_amount, slogan, charge_consumed_amount, last_dianjiang_effect_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(room_id) DO UPDATE SET
            target_amount = excluded.target_amount,
            slogan = excluded.slogan,
            charge_consumed_amount = excluded.charge_consumed_amount,
            last_dianjiang_effect_at = excluded.last_dianjiang_effect_at
        `
        )
        .run(
          this.roomId,
          nextState.targetAmount,
          nextState.slogan,
          nextState.chargeConsumedAmount,
          nextState.lastDianjiangEffectAt ?? null
        );

      this.database.prepare("DELETE FROM sponsor_records WHERE room_id = ?").run(this.roomId);

      const insertSponsor = this.database.prepare(
        `
        INSERT INTO sponsor_records (
          id, room_id, boss_name, amount, program_name, note, counts_toward_charge, avatar_url, hidden_from_today_at, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      );

      for (const record of nextState.sponsors) {
        insertSponsor.run(
          record.id,
          this.roomId,
          record.bossName,
          record.amount,
          record.programName,
          record.note,
          record.countsTowardCharge === false ? 0 : 1,
          record.avatarUrl ?? null,
          record.hiddenFromTodayAt ?? null,
          record.createdAt
        );
      }
    });

    saveState(state);
  }

  private static getDatabase(databasePath: string): Database.Database {
    const cached = this.databases.get(databasePath);
    if (cached) {
      return cached;
    }

    const database = new Database(databasePath);
    database.pragma("journal_mode = WAL");
    this.databases.set(databasePath, database);
    return database;
  }

  private static initializeSchema(database: Database.Database): void {
    database.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        viewer_password_hash TEXT,
        viewer_password_salt TEXT,
        deleted_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS room_settings (
        room_id TEXT PRIMARY KEY,
        target_amount REAL NOT NULL,
        slogan TEXT NOT NULL,
        charge_consumed_amount REAL NOT NULL DEFAULT 0,
        last_dianjiang_effect_at INTEGER,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS sponsor_records (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        boss_name TEXT NOT NULL,
        amount REAL NOT NULL,
        program_name TEXT NOT NULL,
        note TEXT NOT NULL,
        counts_toward_charge INTEGER NOT NULL DEFAULT 1,
        avatar_url TEXT,
        hidden_from_today_at INTEGER,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_sponsor_records_room_created
        ON sponsor_records(room_id, created_at);
    `);
    this.ensureColumn(database, "rooms", "deleted_at", "INTEGER");
    this.ensureColumn(database, "rooms", "viewer_password_hash", "TEXT");
    this.ensureColumn(database, "rooms", "viewer_password_salt", "TEXT");
    this.ensureColumn(database, "room_settings", "charge_consumed_amount", "REAL NOT NULL DEFAULT 0");
    this.ensureColumn(database, "room_settings", "last_dianjiang_effect_at", "INTEGER");
    this.ensureColumn(database, "sponsor_records", "counts_toward_charge", "INTEGER NOT NULL DEFAULT 1");
    this.ensureColumn(database, "sponsor_records", "avatar_url", "TEXT");
    this.ensureColumn(database, "sponsor_records", "hidden_from_today_at", "INTEGER");
  }

  private static ensureColumn(database: Database.Database, tableName: string, columnName: string, definition: string): void {
    const columns = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
    if (columns.some((column) => column.name === columnName)) {
      return;
    }

    database.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`).run();
  }

  private static ensureDefaultRooms(database: Database.Database): void {
    for (const room of DEFAULT_ROOMS) {
      this.ensureRoom(database, room.slug, room.name);
    }
  }

  private static ensureRoom(database: Database.Database, roomSlug: string, roomName = roomSlug): string {
    const now = Date.now();
    database
      .prepare(
        `
        INSERT INTO rooms (id, slug, name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(slug) DO NOTHING
      `
      )
      .run(randomUUID(), roomSlug, roomName, now, now);

    const room = database.prepare("SELECT id FROM rooms WHERE slug = ?").get(roomSlug) as RoomRow | undefined;
    if (!room) {
      throw new Error(`Room not found after creation: ${roomSlug}`);
    }

    database
      .prepare(
        `
          INSERT INTO room_settings (room_id, target_amount, slogan, charge_consumed_amount)
          VALUES (?, ?, ?, 0)
          ON CONFLICT(room_id) DO NOTHING
      `
      )
      .run(room.id, DEFAULT_TARGET_AMOUNT, DEFAULT_SLOGAN);

    return room.id;
  }

  private loadSettings(): SettingsRow {
    const settings = this.database
      .prepare(
        "SELECT target_amount, slogan, charge_consumed_amount, last_dianjiang_effect_at FROM room_settings WHERE room_id = ?"
      )
      .get(this.roomId) as SettingsRow | undefined;

    if (!settings) {
      return {
        target_amount: DEFAULT_TARGET_AMOUNT,
        slogan: DEFAULT_SLOGAN,
        charge_consumed_amount: 0,
        last_dianjiang_effect_at: null
      };
    }

    return settings;
  }

  private async migrateLegacyJsonIfNeeded(legacyJsonPath: string | undefined): Promise<void> {
    if (!legacyJsonPath || this.roomSlug !== "default" || !this.isDefaultRoomEmpty()) {
      return;
    }

    const legacyState = await this.loadLegacyState(legacyJsonPath);
    if (legacyState) {
      await this.save(legacyState);
    }
  }

  private isDefaultRoomEmpty(): boolean {
    const settings = this.loadSettings();
    const sponsorCount = this.database
      .prepare("SELECT COUNT(*) AS count FROM sponsor_records WHERE room_id = ?")
      .get(this.roomId) as { count: number };

    return (
      settings.target_amount === DEFAULT_TARGET_AMOUNT &&
      settings.slogan === DEFAULT_SLOGAN &&
      sponsorCount.count === 0
    );
  }

  private async loadLegacyState(legacyJsonPath: string): Promise<AppState | null> {
    try {
      const raw = await readFile(legacyJsonPath, "utf8");
      const parsed = JSON.parse(raw) as Partial<AppState>;
      return {
        targetAmount: typeof parsed.targetAmount === "number" ? parsed.targetAmount : DEFAULT_TARGET_AMOUNT,
        slogan: typeof parsed.slogan === "string" ? parsed.slogan : DEFAULT_SLOGAN,
        chargeConsumedAmount: typeof parsed.chargeConsumedAmount === "number" ? parsed.chargeConsumedAmount : 0,
        lastDianjiangEffectAt:
          typeof parsed.lastDianjiangEffectAt === "number" ? parsed.lastDianjiangEffectAt : undefined,
        sponsors: Array.isArray(parsed.sponsors)
          ? (parsed.sponsors as SponsorRecord[]).map((record) => ({
              ...record,
              countsTowardCharge: record.countsTowardCharge !== false,
              avatarUrl: typeof record.avatarUrl === "string" && record.avatarUrl.trim() ? record.avatarUrl : undefined,
              hiddenFromTodayAt: Number.isFinite(record.hiddenFromTodayAt) ? record.hiddenFromTodayAt : undefined
            }))
          : []
      };
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }
}
