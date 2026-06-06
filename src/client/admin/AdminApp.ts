import type { AuthSession, DerivedAppState, RoomInfo } from "../../shared/types";
import { ApiClient } from "../common/ApiClient";
import { queryRequired } from "../common/dom";
import { RealtimeClient } from "../common/RealtimeClient";
import { RoomContext } from "../common/RoomContext";
import {
  preferredRoomSlug,
  rememberRoomSlug,
  renderRoomOptions,
  savedRoomSlug
} from "../common/RoomSelection";
import { AdminSummaryView } from "./AdminSummaryView";
import { RecordListView } from "./RecordListView";
import { SponsorFormController } from "./SponsorFormController";
import { TargetFormController } from "./TargetFormController";

export class AdminApp {
  private readonly sponsorForm: SponsorFormController;
  private readonly targetForm: TargetFormController;
  private readonly summaryView: AdminSummaryView;
  private readonly recordListView: RecordListView;
  private readonly trashListView: RecordListView;
  private readonly trashPanel: HTMLElement;
  private readonly startDianjiangButton: HTMLButtonElement;
  private readonly removeTodaySponsorsButton: HTMLButtonElement;
  private readonly deleteAllSponsorsButton: HTMLButtonElement;
  private readonly clearTrashButton: HTMLButtonElement;
  private readonly authForm: HTMLFormElement;
  private readonly authPasswordInput: HTMLInputElement;
  private readonly authStatus: HTMLElement;
  private readonly logoutButton: HTMLButtonElement;
  private readonly roomSelect: HTMLSelectElement;
  private readonly roomForm: HTMLFormElement;
  private readonly roomNameInput: HTMLInputElement;
  private readonly roomViewerPasswordInput: HTMLInputElement;
  private readonly updateRoomViewerPasswordButton: HTMLButtonElement;
  private readonly deleteRoomButton: HTMLButtonElement;
  private session: AuthSession | null = null;
  private rooms: RoomInfo[] = [];
  private latestState: DerivedAppState | null = null;
  private trashCount = 0;
  private sourceId = 0;

  public constructor(
    private apiClient: ApiClient,
    private realtimeClient: RealtimeClient
  ) {
    this.sponsorForm = new SponsorFormController(
      queryRequired("#sponsorForm"),
      queryRequired("#formError")
    );
    this.targetForm = new TargetFormController(queryRequired("#targetForm"));
    this.summaryView = new AdminSummaryView(
      queryRequired("#adminTotal"),
      queryRequired("#targetAmountInput"),
      queryRequired("#sloganInput"),
      queryRequired("#adminStatus")
    );
    this.recordListView = new RecordListView(queryRequired("#recordList"));
    this.trashListView = new RecordListView(queryRequired("#trashList"));
    this.trashPanel = queryRequired("#trashPanel");
    this.startDianjiangButton = queryRequired("#startDianjiangButton");
    this.removeTodaySponsorsButton = queryRequired("#removeTodaySponsorsButton");
    this.deleteAllSponsorsButton = queryRequired("#deleteAllSponsorsButton");
    this.clearTrashButton = queryRequired("#clearTrashButton");
    this.authForm = queryRequired("#authForm");
    this.authPasswordInput = queryRequired("#authPasswordInput");
    this.authStatus = queryRequired("#authStatus");
    this.logoutButton = queryRequired("#logoutButton");
    this.roomSelect = queryRequired("#roomSelect");
    this.roomForm = queryRequired("#roomForm");
    this.roomNameInput = queryRequired("#roomNameInput");
    this.roomViewerPasswordInput = queryRequired("#roomViewerPasswordInput");
    this.updateRoomViewerPasswordButton = queryRequired("#updateRoomViewerPasswordButton");
    this.deleteRoomButton = queryRequired("#deleteRoomButton");
  }

  public async start(): Promise<void> {
    this.authForm.addEventListener("submit", (event) => void this.login(event));
    this.logoutButton.addEventListener("click", () => void this.logout());
    this.roomSelect.addEventListener("change", () => void this.changeRoom());
    this.roomForm.addEventListener("submit", (event) => void this.createRoom(event));
    this.deleteRoomButton.addEventListener("click", () => void this.deleteSelectedRoom());
    this.updateRoomViewerPasswordButton.addEventListener("click", () => void this.updateRoomViewerPassword());

    this.sponsorForm.onSubmit(async (request) => {
      try {
        await this.apiClient.addSponsor(request);
      } catch (error) {
        this.sponsorForm.showError(error instanceof Error ? error.message : "添加失败");
      }
    });

    this.targetForm.onSubmit(async (request) => {
      await this.apiClient.updateSettings(request);
    });

    this.startDianjiangButton.addEventListener("click", () => {
      void this.apiClient.startDianjiang();
    });

    this.removeTodaySponsorsButton.addEventListener("click", () => {
      void this.apiClient.removeTodaySponsors();
    });

    this.deleteAllSponsorsButton.addEventListener("click", () => {
      void this.deleteAllSponsors();
    });

    this.clearTrashButton.addEventListener("click", () => {
      void this.clearSponsorTrash();
    });

    this.recordListView.onRemoveFromToday(async (id) => {
      await this.apiClient.removeSponsorFromToday(id);
    });

    this.recordListView.onAddToToday(async (id) => {
      await this.apiClient.addSponsorToToday(id);
    });

    this.recordListView.onUpdateAmount(async (id, amount) => {
      await this.apiClient.updateSponsorAmount(id, amount);
    });
    this.trashListView.onUpdateAmount(async (id, amount) => {
      await this.apiClient.updateSponsorAmount(id, amount);
      await this.refreshTrash();
    });

    this.recordListView.onDeletePermanently(async (id) => {
      try {
        const state = await this.apiClient.deleteSponsor(id);
        this.render(state);
        await this.refreshTrash();
      } catch (error) {
        this.authStatus.textContent = error instanceof Error ? error.message : "删除失败";
      }
    });

    this.trashListView.onDeletePermanently(async (id) => {
      if (!window.confirm("确认彻底删除这条回收站记录吗？此操作不可恢复。")) {
        return;
      }

      try {
        const state = await this.apiClient.deleteSponsorPermanently(id);
        this.render(state);
        await this.refreshTrash();
      } catch (error) {
        this.authStatus.textContent = error instanceof Error ? error.message : "彻底删除失败";
      }
    });

    this.trashListView.onRestoreSponsor(async (id) => {
      await this.apiClient.restoreSponsor(id);
      await this.refreshTrash();
    });

    this.recordListView.onUpdateAvatar(async (id, avatarDataUrl) => {
      await this.apiClient.updateSponsorAvatar(id, avatarDataUrl);
    });
    this.trashListView.onUpdateAvatar(async (id, avatarDataUrl) => {
      await this.apiClient.updateSponsorAvatar(id, avatarDataUrl);
      await this.refreshTrash();
    });

    this.session = await this.apiClient.getAuthSession();
    await this.loadRooms();
  }

  private render(state: DerivedAppState): void {
    this.latestState = state;
    const canViewRecords = this.session !== null;
    const visibleSponsors = canViewRecords ? state.sponsors : [];
    const visibleProgramQueue = canViewRecords ? state.programQueue : [];
    this.sponsorForm.setKnownSponsors(visibleSponsors);
    this.summaryView.render(state);
    this.recordListView.render(visibleSponsors, visibleProgramQueue);
    const canOperate = this.sessionCanOperateCurrentRoom();
    const canManage = this.session?.role === "admin";
    this.startDianjiangButton.disabled = !canOperate || state.totalAmount <= 0;
    this.startDianjiangButton.textContent = state.goalReached ? "开始点将" : "开始点将（当前不足）";
    this.removeTodaySponsorsButton.disabled = !canManage || state.programQueue.length === 0;
    this.deleteAllSponsorsButton.disabled = !canManage || visibleSponsors.length === 0;
    this.clearTrashButton.disabled = !canManage || this.trashCount === 0;
    this.deleteRoomButton.disabled = !canManage || !this.roomSelect.value;
    this.roomViewerPasswordInput.disabled = !canManage;
    this.updateRoomViewerPasswordButton.disabled = !canManage || !this.roomSelect.value;
    this.trashPanel.hidden = !canManage;
    this.trashListView.setCanManage(canManage);
    if (canManage) {
      void this.refreshTrash(this.sourceId);
    } else {
      this.trashCount = 0;
      this.clearTrashButton.disabled = true;
      this.trashListView.renderTrash([]);
    }
  }

  private async refreshTrash(sourceId = this.sourceId): Promise<void> {
    if (this.session?.role !== "admin") {
      return;
    }

    const trash = await this.apiClient.getSponsorTrash();
    if (sourceId === this.sourceId) {
      this.trashCount = trash.length;
      this.clearTrashButton.disabled = this.session?.role !== "admin" || trash.length === 0;
      this.trashListView.renderTrash(trash);
    }
  }

  private async login(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    try {
      this.session = await this.apiClient.login(this.authPasswordInput.value);
      this.authPasswordInput.value = "";
      this.applyRole();
      if (this.latestState) {
        this.render(this.latestState);
      }
    } catch (error) {
      this.authStatus.textContent = error instanceof Error ? error.message : "登录失败";
    }
  }

  private async logout(): Promise<void> {
    await this.apiClient.logout();
    this.session = null;
    this.applyRole();
    if (this.latestState) {
      this.render(this.latestState);
    }
  }

  private async loadRooms(): Promise<void> {
    this.rooms = await this.apiClient.getRooms();
    const currentSlug = RoomContext.fromPath(window.location.pathname).slug;
    const selectedSlug = preferredRoomSlug(this.rooms, currentSlug, savedRoomSlug(window.localStorage));

    rememberRoomSlug(window.localStorage, selectedSlug);
    renderRoomOptions(this.roomSelect, this.rooms, selectedSlug);
    await this.switchDataSource(selectedSlug);
  }

  private async changeRoom(): Promise<void> {
    const slug = this.roomSelect.value;
    if (!slug) {
      return;
    }

    rememberRoomSlug(window.localStorage, slug);
    await this.switchDataSource(slug);
  }

  private async createRoom(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const room = await this.apiClient.createRoom(this.roomNameInput.value);
    this.roomNameInput.value = "";
    rememberRoomSlug(window.localStorage, room.slug);
    this.rooms = await this.apiClient.getRooms();
    renderRoomOptions(this.roomSelect, this.rooms, room.slug);
    await this.switchDataSource(room.slug);
  }

  private async deleteSelectedRoom(): Promise<void> {
    const slug = this.roomSelect.value;
    if (!slug || !window.confirm("确认删除这个房间吗？历史数据会保留，只从选择器隐藏。")) {
      return;
    }

    this.rooms = await this.apiClient.deleteRoom(slug);
    const nextRoom = this.rooms[0];
    const nextSlug = nextRoom?.slug ?? "default";
    rememberRoomSlug(window.localStorage, nextSlug);
    renderRoomOptions(this.roomSelect, this.rooms, nextSlug);
    await this.switchDataSource(nextSlug);
  }

  private async deleteAllSponsors(): Promise<void> {
    const count = this.latestState?.sponsors.length ?? 0;
    if (count === 0 || !window.confirm(`确认一键删除当前房间的 ${count} 条赞助记录吗？记录会先进入回收站。`)) {
      return;
    }

    try {
      const state = await this.apiClient.deleteAllSponsors();
      this.render(state);
      await this.refreshTrash();
    } catch (error) {
      this.authStatus.textContent = error instanceof Error ? error.message : "一键删除失败";
    }
  }

  private async clearSponsorTrash(): Promise<void> {
    if (this.trashCount === 0 || !window.confirm(`确认清空回收站的 ${this.trashCount} 条记录吗？此操作不可恢复。`)) {
      return;
    }

    try {
      const state = await this.apiClient.clearSponsorTrash();
      this.render(state);
      await this.refreshTrash();
    } catch (error) {
      this.authStatus.textContent = error instanceof Error ? error.message : "清空回收站失败";
    }
  }

  private async updateRoomViewerPassword(): Promise<void> {
    const slug = this.roomSelect.value;
    const password = this.roomViewerPasswordInput.value;
    if (!slug || !password.trim()) {
      this.authStatus.textContent = "请输入本房间普通密码";
      return;
    }

    await this.apiClient.updateRoomViewerPassword(slug, password);
    this.roomViewerPasswordInput.value = "";
    this.authStatus.textContent = "本房间普通密码已更新";
  }

  private async switchDataSource(roomSlug: string): Promise<void> {
    rememberRoomSlug(window.localStorage, roomSlug);
    renderRoomOptions(this.roomSelect, this.rooms, roomSlug);
    this.realtimeClient.disconnect();
    this.apiClient = this.apiClientForRoom(roomSlug);
    this.realtimeClient = this.realtimeClientForRoom(roomSlug);
    this.latestState = null;
    this.trashCount = 0;
    this.clearTrashButton.disabled = true;
    const sourceId = ++this.sourceId;

    this.applyRole();
    this.realtimeClient.onStateUpdated((state) => {
      if (sourceId === this.sourceId) {
        this.render(state);
      }
    });

    const state = await this.apiClient.getState();
    if (sourceId === this.sourceId) {
      this.render(state);
    }
  }

  private apiClientForRoom(roomSlug: string): ApiClient {
    return new ApiClient(new RoomContext(roomSlug));
  }

  private realtimeClientForRoom(roomSlug: string): RealtimeClient {
    return new RealtimeClient(new RoomContext(roomSlug));
  }

  private applyRole(): void {
    const canAdd = this.sessionCanOperateCurrentRoom();
    const canOperate = canAdd;
    const canManage = this.session?.role === "admin";
    this.sponsorForm.setEnabled(canAdd);
    this.targetForm.setEnabled(canOperate);
    this.recordListView.setCanManage(canManage);
    this.trashListView.setCanManage(canManage);
    this.trashPanel.hidden = !canManage;
    this.deleteAllSponsorsButton.disabled = !canManage || !this.latestState?.sponsors.length;
    this.clearTrashButton.disabled = !canManage || this.trashCount === 0;
    this.roomForm.querySelectorAll<HTMLInputElement | HTMLButtonElement>("input, button").forEach((element) => {
      element.disabled = !canManage;
    });
    this.deleteRoomButton.disabled = !canManage || !this.roomSelect.value;
    this.roomViewerPasswordInput.disabled = !canManage;
    this.updateRoomViewerPasswordButton.disabled = !canManage || !this.roomSelect.value;
    this.logoutButton.disabled = !this.session;
    this.authStatus.textContent = this.session
      ? this.session.role === "admin"
        ? "超级权限"
        : this.sessionCanOperateCurrentRoom()
          ? "普通权限"
          : "请登录本房间普通权限"
      : "未登录";
  }

  private sessionCanOperateCurrentRoom(): boolean {
    if (this.session?.role === "admin") {
      return true;
    }

    return this.session?.role === "viewer" && this.session.roomSlug === this.currentRoomSlug();
  }

  private currentRoomSlug(): string {
    return this.roomSelect.value || savedRoomSlug(window.localStorage);
  }
}
