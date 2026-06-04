import { mkdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, normalize, sep } from "node:path";

export interface SponsorAvatarStorage {
  saveAvatar(roomSlug: string, sponsorId: string, dataUrl: string): Promise<string>;
  clearAvatar(avatarUrl: string | undefined): Promise<void>;
}

const MIME_EXTENSIONS = new Map([
  ["image/webp", "webp"],
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/jpg", "jpg"]
]);

export class AvatarService implements SponsorAvatarStorage {
  public constructor(private readonly avatarDirectory: string) {}

  public async saveAvatar(roomSlug: string, sponsorId: string, dataUrl: string): Promise<string> {
    const parsed = this.parseDataUrl(dataUrl);
    const fileName = `${this.safeSegment(sponsorId)}.${parsed.extension}`;
    const directory = join(this.avatarDirectory, this.safeSegment(roomSlug));
    const filePath = this.safePath(join(directory, fileName));

    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, parsed.bytes);

    return `/avatars/${encodeURIComponent(this.safeSegment(roomSlug))}/${encodeURIComponent(fileName)}`;
  }

  public async clearAvatar(avatarUrl: string | undefined): Promise<void> {
    if (!avatarUrl?.startsWith("/avatars/")) {
      return;
    }

    const [, , rawRoomSlug, rawFileName] = avatarUrl.split("/");
    if (!rawRoomSlug || !rawFileName) {
      return;
    }

    const filePath = this.safePath(
      join(this.avatarDirectory, this.safeSegment(decodeURIComponent(rawRoomSlug)), basename(decodeURIComponent(rawFileName)))
    );
    await rm(filePath, { force: true });
  }

  private parseDataUrl(dataUrl: string): { bytes: Buffer; extension: string } {
    const match = /^data:(image\/(?:webp|png|jpe?g));base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl.trim());
    if (!match) {
      throw new Error("头像图片格式不正确");
    }

    const extension = MIME_EXTENSIONS.get(match[1].toLowerCase());
    if (!extension) {
      throw new Error("头像只支持 WebP、PNG 或 JPG");
    }

    return {
      bytes: Buffer.from(match[2].replace(/\s/g, ""), "base64"),
      extension
    };
  }

  private safeSegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]/g, "-") || "avatar";
  }

  private safePath(filePath: string): string {
    const normalizedRoot = normalize(this.avatarDirectory);
    const normalizedPath = normalize(filePath);
    if (normalizedPath !== normalizedRoot && !normalizedPath.startsWith(`${normalizedRoot}${sep}`)) {
      throw new Error("头像保存路径不正确");
    }

    return normalizedPath;
  }
}
