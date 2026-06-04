import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin layout", () => {
  const adminHtml = readFileSync(resolve(process.cwd(), "admin.html"), "utf8");
  const adminCss = readFileSync(resolve(process.cwd(), "src/client/styles/admin.css"), "utf8");
  const adminApp = readFileSync(resolve(process.cwd(), "src/client/admin/AdminApp.ts"), "utf8");
  const sponsorForm = readFileSync(resolve(process.cwd(), "src/client/admin/SponsorFormController.ts"), "utf8");
  const recordListView = readFileSync(resolve(process.cwd(), "src/client/admin/RecordListView.ts"), "utf8");

  it("asks whether a new sponsor joins startup charge", () => {
    expect(adminHtml).toContain('name="countsTowardCharge"');
    expect(adminHtml).toContain('type="checkbox"');
    expect(adminHtml).toContain("加入启动资金充能");
    expect(sponsorForm).toContain("countsTowardCharge");
    expect(sponsorForm).toContain("STARTUP_FUNDING_PROGRAM_NAME");
    expect(sponsorForm).toContain("readOnly");
  });

  it("adds avatar picker and clipboard controls to the sponsor form", () => {
    expect(adminHtml).toContain('id="avatarPreview"');
    expect(adminHtml).toContain('id="avatarFileInput"');
    expect(adminHtml).toContain('id="pasteAvatarButton"');
    expect(adminHtml).toContain('id="clearAvatarButton"');
    expect(sponsorForm).toContain("avatarDataUrl");
    expect(sponsorForm).toContain("compressAvatarFile");
    expect(sponsorForm).toContain("readAvatarFromClipboard");
    expect(adminCss).toContain(".avatar-picker");
    expect(adminCss).toContain(".avatar-preview");
  });

  it("includes room selection, room management, and password login controls", () => {
    expect(adminHtml).toContain('id="roomSelect"');
    expect(adminHtml).toContain('id="roomForm"');
    expect(adminHtml).toContain('id="deleteRoomButton"');
    expect(adminHtml).toContain('id="authForm"');
    expect(adminHtml).toContain('name="password"');
    expect(adminApp).toContain("this.apiClient.login");
    expect(adminApp).toContain("this.apiClient.getRooms");
    expect(adminApp).toContain("this.apiClient.createRoom");
    expect(adminApp).toContain("this.apiClient.deleteRoom");
  });

  it("adds start dianjiang and bulk today-list removal controls", () => {
    expect(adminHtml).toContain('id="startDianjiangButton"');
    expect(adminHtml).toContain("开始点将");
    expect(adminHtml).toContain('id="removeTodaySponsorsButton"');
    expect(adminApp).toContain("this.apiClient.startDianjiang()");
    expect(adminApp).toContain("this.apiClient.removeTodaySponsors()");
    expect(adminApp).toContain("canOperate");
  });

  it("uses inline amount editing and soft remove actions in records", () => {
    expect(recordListView).toContain("onUpdateAmount");
    expect(recordListView).toContain("onRemoveFromToday");
    expect(recordListView).toContain("onAddToToday");
    expect(recordListView).toContain("onDeletePermanently");
    expect(recordListView).toContain("onUpdateAvatar");
    expect(recordListView).toContain("record-amount-input");
    expect(recordListView).toContain("record-avatar");
    expect(recordListView).toContain("update-avatar");
    expect(recordListView).toContain("clear-avatar");
    expect(recordListView).toContain("移除今日榜单");
    expect(recordListView).toContain("加入今日榜单");
    expect(recordListView).toContain("永久删除");
    expect(adminApp).toContain("this.apiClient.addSponsorToToday");
    expect(adminApp).toContain("this.apiClient.deleteSponsor");
    expect(adminApp).toContain("this.apiClient.updateSponsorAvatar");
    expect(adminCss).toContain(".record-actions");
    expect(adminCss).toContain(".record-amount-input");
    expect(adminCss).toContain(".record-avatar");
  });
});
