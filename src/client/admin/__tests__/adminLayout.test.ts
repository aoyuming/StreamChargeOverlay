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
    expect(adminHtml).toContain("粘贴头像 Ctrl+V");
    expect(adminHtml).toContain('id="clearAvatarButton"');
    expect(sponsorForm).toContain("avatarDataUrl");
    expect(sponsorForm).toContain("setKnownSponsors");
    expect(sponsorForm).toContain("bossNameInput");
    expect(sponsorForm).toContain("matchExistingSponsorAvatar");
    expect(sponsorForm).toContain("fetch(");
    expect(sponsorForm).toContain("compressAvatarFile");
    expect(sponsorForm).toContain("readAvatarFromClipboard");
    expect(adminApp).toContain("this.sponsorForm.setKnownSponsors(visibleSponsors)");
    expect(adminCss).toContain(".avatar-picker");
    expect(adminCss).toContain(".avatar-preview");
  });

  it("includes room selection, room management, and password login controls", () => {
    expect(adminHtml).toContain('id="roomSelect"');
    expect(adminHtml).toContain('id="roomForm"');
    expect(adminHtml).toContain('id="deleteRoomButton"');
    expect(adminHtml).toContain('id="roomViewerPasswordInput"');
    expect(adminHtml).toContain('id="updateRoomViewerPasswordButton"');
    expect(adminHtml).toContain('id="authForm"');
    expect(adminHtml).toContain('name="password"');
    expect(adminApp).toContain("this.apiClient.login");
    expect(adminApp).toContain("this.apiClient.getRooms");
    expect(adminApp).toContain("this.apiClient.createRoom");
    expect(adminApp).toContain("this.apiClient.deleteRoom");
    expect(adminApp).toContain("this.apiClient.updateRoomViewerPassword");
    expect(adminApp).toContain("sessionCanOperateCurrentRoom");
  });

  it("adds start dianjiang and bulk today-list removal controls", () => {
    expect(adminHtml).toContain('id="startDianjiangButton"');
    expect(adminHtml).toContain("开始点将");
    expect(adminHtml).toContain('id="removeTodaySponsorsButton"');
    expect(adminHtml).toContain('id="deleteAllSponsorsButton"');
    expect(adminApp).toContain("this.apiClient.startDianjiang()");
    expect(adminApp).toContain("this.apiClient.removeTodaySponsors()");
    expect(adminApp).toContain("this.apiClient.deleteAllSponsors()");
    expect(adminApp).toContain("canOperate");
  });

  it("renders returned state immediately after confirmed destructive sponsor actions", () => {
    const expectImmediateRenderAfter = (call: string) => {
      const callIndex = adminApp.indexOf(call);
      expect(callIndex).toBeGreaterThanOrEqual(0);
      expect(adminApp.slice(callIndex, callIndex + 180)).toContain("this.render(state);");
    };

    expectImmediateRenderAfter("const state = await this.apiClient.deleteSponsor(id);");
    expectImmediateRenderAfter("const state = await this.apiClient.deleteSponsorPermanently(id);");
    expectImmediateRenderAfter("const state = await this.apiClient.deleteAllSponsors();");
    expectImmediateRenderAfter("const state = await this.apiClient.clearSponsorTrash();");
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
    expect(recordListView).toContain("paste-avatar");
    expect(recordListView).toContain("粘贴头像 Ctrl+V");
    expect(recordListView).toContain("readAvatarFromClipboard");
    expect(recordListView).toContain("window.confirm");
    expect(recordListView).toContain("previewRecordAvatar");
    expect(recordListView).toContain("restoreRecordAvatar");
    expect(recordListView.indexOf("this.previewRecordAvatar(row, avatarDataUrl)")).toBeLessThan(
      recordListView.indexOf("window.confirm")
    );
    expect(recordListView).toContain("clear-avatar");
    expect(recordListView).toContain("移除今日榜单");
    expect(recordListView).toContain("加入今日榜单");
    expect(recordListView).toContain('deleteButton.textContent = mode === "trash" ? "彻底删除" : "删除"');
    expect(adminApp).toContain("this.apiClient.addSponsorToToday");
    expect(adminApp).toContain("this.apiClient.deleteSponsor");
    expect(adminApp).toContain("this.apiClient.updateSponsorAvatar");
    expect(adminCss).toContain(".record-actions");
    expect(adminCss).toContain(".record-amount-input");
    expect(adminCss).toContain(".record-avatar");
  });

  it("adds an admin-only recycle bin list with restore support", () => {
    expect(adminHtml).toContain('id="trashPanel"');
    expect(adminHtml).toContain("回收站");
    expect(adminHtml).toContain('id="trashList"');
    expect(adminHtml).toContain('id="clearTrashButton"');
    expect(adminApp).toContain("trashListView");
    expect(adminApp).toContain("this.apiClient.getSponsorTrash");
    expect(adminApp).toContain("this.apiClient.restoreSponsor");
    expect(adminApp).toContain("this.apiClient.clearSponsorTrash");
    expect(adminApp).toContain("this.apiClient.deleteSponsorPermanently");
    expect(recordListView).toContain("renderTrash");
    expect(recordListView).toContain("restore-sponsor");
    expect(recordListView).toContain('deleteButton.textContent = mode === "trash" ? "彻底删除" : "删除"');
    expect(recordListView).toContain("还原");
  });

  it("uses a full-width three-column workspace without page-level vertical scrolling", () => {
    expect(adminHtml.indexOf('id="trashPanel"')).toBeGreaterThan(adminHtml.indexOf("</aside>"));
    expect(adminCss).toContain("height: 100vh");
    expect(adminCss).toContain("overflow: hidden");
    expect(adminCss).toContain("width: calc(100vw - 40px)");
    expect(adminCss).toContain('grid-template-areas: "sponsor main trash"');
    expect(adminCss).toContain("grid-area: trash");
    expect(adminCss).toContain("grid-template-rows: auto minmax(0, 1fr)");
    expect(adminCss).toContain("max-height: none");
  });

  it("keeps room management inside the fixed admin page instead of navigating to room URLs", () => {
    expect(adminApp).toContain("switchDataSource(room.slug)");
    expect(adminApp).toContain("switchDataSource(slug)");
    expect(adminApp).toContain("apiClientForRoom(roomSlug)");
    expect(adminApp).toContain("realtimeClientForRoom(roomSlug)");
    expect(adminApp).not.toContain("roomPagePath");
    expect(adminApp).not.toContain("window.location.href");
    expect(adminApp).not.toContain("window.location.replace");
  });

  it("does not render sponsor records before an admin or room login", () => {
    expect(adminApp).toContain("const canViewRecords = this.session !== null;");
    expect(adminApp).toContain("const visibleSponsors = canViewRecords ? state.sponsors : [];");
    expect(adminApp).toContain("const visibleProgramQueue = canViewRecords ? state.programQueue : [];");
    expect(adminApp).toContain("this.recordListView.render(visibleSponsors, visibleProgramQueue);");
    expect(adminApp).toContain("this.sponsorForm.setKnownSponsors(visibleSponsors)");
    expect(adminApp).not.toContain("this.recordListView.render(state.sponsors, state.programQueue)");
  });
});
