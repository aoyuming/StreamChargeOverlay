import type { StateRepository } from "../../shared/types";
import { SqliteRoomStateRepository } from "./SqliteRoomStateRepository";

export interface RoomStateRepositoryFactory {
  getRepository(roomSlug: string): Promise<StateRepository>;
}

// Creates room-scoped repositories while keeping one SQLite file for deployment.
export class SqliteRoomStateRepositoryFactory implements RoomStateRepositoryFactory {
  public constructor(
    private readonly databasePath: string,
    private readonly legacyJsonPath: string | undefined
  ) {}

  public async getRepository(roomSlug: string): Promise<StateRepository> {
    return SqliteRoomStateRepository.open(this.databasePath, roomSlug, {
      legacyJsonPath: this.legacyJsonPath
    });
  }
}
