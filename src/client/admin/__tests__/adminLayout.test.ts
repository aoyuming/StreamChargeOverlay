import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin layout", () => {
  const adminHtml = readFileSync(resolve(process.cwd(), "admin.html"), "utf8");
  const adminCss = readFileSync(resolve(process.cwd(), "src/client/styles/admin.css"), "utf8");
  const adminApp = readFileSync(resolve(process.cwd(), "src/client/admin/AdminApp.ts"), "utf8");
  const sponsorForm = readFileSync(resolve(process.cwd(), "src/client/admin/SponsorFormController.ts"), "utf8");
  const recordListView = readFileSync(resolve(process.cwd(), "src/client/admin/RecordListView.ts"), "utf8");
  const todayDisplayListPath = resolve(process.cwd(), "src/client/admin/TodayDisplayListView.ts");
  const todayDisplayListView = existsSync(todayDisplayListPath) ? readFileSync(todayDisplayListPath, "utf8") : "";
  const cssRule = (selector: string) => {
    const start = adminCss.indexOf(selector);
    expect(start).toBeGreaterThanOrEqual(0);
    const end = adminCss.indexOf("\n}", start);
    expect(end).toBeGreaterThan(start);
    return adminCss.slice(start, end);
  };

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
    expect(adminHtml.indexOf('id="removeTodaySponsorsButton"')).toBeLessThan(adminHtml.indexOf('id="recordList"'));
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

  it("adds current startup funding editing for ordinary room operators", () => {
    expect(adminHtml).toContain('id="currentChargeAmountInput"');
    expect(adminHtml).toContain('id="updateCurrentChargeButton"');
    expect(adminHtml).toContain('id="resetCurrentChargeButton"');
    expect(adminHtml).toContain('class="compact-input-field target-input-field"');
    expect(adminHtml).toContain('class="compact-input-field wide-field"');
    expect(adminHtml).toContain('class="compact-input-field current-charge-field"');
    expect(adminHtml).toContain('class="charge-actions"');
    expect(adminHtml).toContain("保存资金");
    expect(adminHtml).toContain("归0");
    expect(adminHtml).toContain('id="resetCurrentChargeButton" class="secondary-button"');
    expect(adminHtml).not.toContain('id="resetCurrentChargeButton" class="ghost-button danger"');
    expect(adminHtml).not.toContain("保存当前启动资金");
    expect(adminHtml).not.toContain("金额归0");
    expect(cssRule(".compact-panel {")).toContain("grid-template-columns: minmax(0, 1fr) 200px;");
    expect(cssRule(".compact-panel .compact-input-field {")).toContain("grid-column: 1;");
    expect(cssRule(".compact-panel .wide-field {")).toContain("grid-column: 1;");
    expect(cssRule(".charge-actions {")).toContain("grid-template-columns: 1fr;");
    expect(adminCss).toContain(".compact-panel > button[type=\"submit\"],\n.compact-panel .primary-button");
    expect(adminApp).toContain("this.apiClient.updateCurrentChargeAmount");
    expect(adminApp).toContain("this.currentChargeAmountInput.disabled = !canOperate");
    expect(adminApp).toContain("this.updateCurrentChargeButton.disabled = !canOperate");
    expect(adminApp).toContain("this.resetCurrentChargeButton.disabled = !canOperate");
    expect(adminApp).toContain("this.resetCurrentChargeAmount()");
    expect(adminApp).toContain("this.apiClient.updateCurrentChargeAmount(0)");
    expect(adminApp).toContain("Number(this.currentChargeAmountInput.value");
  });

  it("adds a dedicated today display list operated separately from all sponsor records", () => {
    expect(adminHtml).toContain('id="todayDisplayPanel"');
    expect(adminHtml).toContain("今日赞助节目榜单");
    expect(adminHtml).toContain('id="todayDisplayList"');
    expect(adminHtml.indexOf('id="todayDisplayPanel"')).toBeLessThan(adminHtml.indexOf("</aside>"));
    expect(adminHtml.indexOf('id="todayDisplayPanel"')).toBeLessThan(adminHtml.indexOf('id="recordList"'));
    expect(adminHtml.indexOf('id="todayDisplayPanel"')).toBeLessThan(adminHtml.indexOf('id="trashPanel"'));
    expect(adminApp).toContain("TodayDisplayListView");
    expect(adminApp).toContain("this.todayDisplayListView.render(visibleProgramQueue)");
    expect(adminApp).toContain("this.todayDisplayListView.setCanOperate(canOperate)");
    expect(todayDisplayListView).toContain("onRemoveFromToday");
    expect(todayDisplayListView).toContain("remove-today");
    expect(todayDisplayListView).toContain("等待大哥登榜");
    expect(adminCss).toContain(".today-display-panel");
    expect(adminCss).toContain(".today-display-row");
  });

  it("keeps sponsor rows compact and moves full editing into the edit panel", () => {
    expect(recordListView).not.toContain("onUpdateAmount");
    expect(recordListView).toContain("onUpdateSponsor");
    expect(recordListView).toContain("onRemoveFromToday");
    expect(recordListView).toContain("onAddToToday");
    expect(recordListView).toContain("onDeletePermanently");
    expect(recordListView).toContain("onUpdateAvatar");
    expect(recordListView).toContain("setPermissions");
    expect(recordListView).not.toContain("record-amount-input");
    expect(recordListView).not.toContain("save-amount");
    expect(recordListView).toContain("actions.append(editButton, quickAddTodayButton)");
    expect(recordListView).toContain('quickAddTodayButton.textContent = isVisibleToday ? "今日展示中" : "加入今日展示"');
    expect(recordListView).toContain("record-edit-form");
    expect(recordListView).toContain('label.className = "record-edit-field";');
    expect(recordListView).toContain("record-edit-boss");
    expect(recordListView).toContain("record-edit-amount");
    expect(recordListView).toContain("record-edit-program");
    expect(recordListView).toContain("record-edit-note");
    expect(recordListView).toContain('noteLabel.className = "record-edit-field record-edit-note-field";');
    expect(recordListView).toContain("record-edit-created");
    expect(recordListView).toContain("record-edit-counts-charge");
    expect(recordListView).toContain("record-edit-today");
    expect(recordListView).toContain("record-edit-avatar-actions");
    expect(recordListView).toContain("record-edit-footer");
    expect(recordListView).toContain("edit-record");
    expect(recordListView).toContain("save-record");
    expect(recordListView).toContain("cancel-edit");
    expect(recordListView).toContain("datetime-local");
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
    expect(recordListView).toContain("canManageToday");
    expect(recordListView).toContain("canManageRecords");
    expect(recordListView).toContain('deleteButton.textContent = mode === "trash" ? "彻底删除" : "删除"');
    expect(recordListView).toContain("syncTodayVisibility");
    expect(adminApp).toContain("this.apiClient.addSponsorToToday");
    expect(adminApp).toContain("this.apiClient.updateSponsor");
    expect(adminApp).toContain("this.apiClient.deleteSponsor");
    expect(adminApp).toContain("this.apiClient.updateSponsorAvatar");
    expect(adminCss).toContain(".record-actions");
    expect(adminCss).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(adminCss).not.toContain(".record-amount-input");
    expect(cssRule(".record-edit-form {")).toContain("grid-template-columns: repeat(4, minmax(0, 1fr));");
    expect(cssRule(".record-edit-field {")).toContain("grid-column: span 2;");
    expect(cssRule(".record-edit-note-field {")).toContain("grid-column: 1 / -1;");
    expect(adminCss).toContain(".record-edit-avatar-actions");
    expect(adminCss).toContain(".record-edit-footer");
    expect(adminCss).toContain(".record-avatar");
  });

  it("adds an admin-only recycle bin list with restore support", () => {
    expect(adminHtml).toContain('id="trashPanel"');
    expect(adminHtml).toContain("回收站");
    expect(adminHtml).toContain('id="trashList"');
    expect(adminHtml).toContain('id="clearTrashButton"');
    expect(adminHtml).toContain("可还原或彻底删除");
    expect(adminHtml).not.toContain("可编辑后还原");
    expect(adminApp).toContain("trashListView");
    expect(adminApp).toContain("this.apiClient.getSponsorTrash");
    expect(adminApp).toContain("this.apiClient.restoreSponsor");
    expect(adminApp).toContain("this.apiClient.clearSponsorTrash");
    expect(adminApp).toContain("this.apiClient.deleteSponsorPermanently");
    expect(recordListView).toContain("renderTrash");
    expect(recordListView).toContain("restore-sponsor");
    expect(recordListView).toContain("actions.append(restoreButton, deleteButton)");
    expect(recordListView).toContain('deleteButton.textContent = mode === "trash" ? "彻底删除" : "删除"');
    expect(recordListView).toContain("还原");
    expect(adminApp).not.toContain("trashListView.onUpdateSponsor");
    expect(adminApp).not.toContain("trashListView.onUpdateAvatar");
  });

  it("splits the right column between sponsor records and trash", () => {
    expect(adminHtml).toContain('class="right-stack"');
    expect(adminHtml.indexOf('id="todayDisplayPanel"')).toBeLessThan(adminHtml.indexOf("</aside>"));
    expect(adminHtml.indexOf('id="recordList"')).toBeGreaterThan(adminHtml.indexOf("</aside>"));
    expect(adminHtml.indexOf('id="recordList"')).toBeLessThan(adminHtml.indexOf('id="trashPanel"'));
    expect(adminCss).toContain("height: 100vh");
    expect(adminCss).toContain("overflow: hidden");
    expect(adminCss).toContain("width: calc(100vw - 40px)");
    expect(adminCss).toContain('grid-template-areas: "sponsor main side"');
    expect(adminCss).toContain(".right-stack");
    expect(adminCss).toContain("grid-area: side");
    expect(adminCss).toContain("grid-template-rows: minmax(0, 1fr) minmax(0, 1fr)");
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
    expect(adminApp).toContain("this.todayDisplayListView.render(visibleProgramQueue);");
    expect(adminApp).toContain("this.recordListView.render(visibleSponsors, visibleProgramQueue);");
    expect(adminApp).toContain("this.sponsorForm.setKnownSponsors(visibleSponsors)");
    expect(adminApp).not.toContain("this.recordListView.render(state.sponsors, state.programQueue)");
  });
});
