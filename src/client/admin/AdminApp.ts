import type { AuthSession, DerivedAppState, RoomInfo } from "../../shared/types";
import { ApiClient } from "../common/ApiClient";
import { queryRequired } from "../common/dom";
import { RealtimeClient } from "../common/RealtimeClient";
import { RoomContext } from "../common/RoomContext";
import {
  preferredRoomSlug,
  rememberRoomSlug,
  renderRoomOptions,
  roomPagePath,
  savedRoomSlug,
  SELECTED_ROOM_STORAGE_KEY
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
  private readonly startDianjiangButton: HTMLButtonElement;
  private readonly removeTodaySponsorsButton: HTMLButtonElement;
  private readonly authForm: HTMLFormElement;
  private readonly authPasswordInput: HTMLInputElement;
  private readonly authStatus: HTMLElement;
  private readonly logoutButton: HTMLButtonElement;
  private readonly roomSelect: HTMLSelectElement;
  private readonly roomForm: HTMLFormElement;
  private readonly roomNameInput: HTMLInputElement;
  private readonly deleteRoomButton: HTMLButtonElement;
  private session: AuthSession | null = null;
  private rooms: RoomInfo[] = [];
  private latestState: DerivedAppState | null = null;

  public constructor(
    private readonly apiClient: ApiClient,
    private readonly realtimeClient: RealtimeClient
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
    this.startDianjiangButton = queryRequired("#startDianjiangButton");
    this.removeTodaySponsorsButton = queryRequired("#removeTodaySponsorsButton");
    this.authForm = queryRequired("#authForm");
    this.authPasswordInput = queryRequired("#authPasswordInput");
    this.authStatus = queryRequired("#authStatus");
    this.logoutButton = queryRequired("#logoutButton");
    this.roomSelect = queryRequired("#roomSelect");
    this.roomForm = queryRequired("#roomForm");
    this.roomNameInput = queryRequired("#roomNameInput");
    this.deleteRoomButton = queryRequired("#deleteRoomButton");
  }

  public async start(): Promise<void> {
    this.authForm.addEventListener("submit", (event) => void this.login(event));
    this.logoutButton.addEventListener("click", () => void this.logout());
    this.roomSelect.addEventListener("change", () => this.changeRoom());
    this.roomForm.addEventListener("submit", (event) => void this.createRoom(event));
    this.deleteRoomButton.addEventListener("click", () => void this.deleteSelectedRoom());

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

    this.recordListView.onRemoveFromToday(async (id) => {
      await this.apiClient.removeSponsorFromToday(id);
    });

    this.recordListView.onAddToToday(async (id) => {
      await this.apiClient.addSponsorToToday(id);
    });

    this.recordListView.onUpdateAmount(async (id, amount) => {
      await this.apiClient.updateSponsorAmount(id, amount);
    });

    this.recordListView.onDeletePermanently(async (id) => {
      await this.apiClient.deleteSponsor(id);
    });

    this.session = await this.apiClient.getAuthSession();
    if (await this.loadRooms()) {
      return;
    }

    this.applyRole();
    this.realtimeClient.onStateUpdated((state) => this.render(state));
    this.render(await this.apiClient.getState());
  }

  private render(state: DerivedAppState): void {
    this.latestState = state;
    this.summaryView.render(state);
    this.recordListView.render(state.sponsors, state.programQueue);
    const canOperate = this.session?.role === "viewer" || this.session?.role === "admin";
    const canManage = this.session?.role === "admin";
    this.startDianjiangButton.disabled = !canOperate || state.totalAmount <= 0;
    this.startDianjiangButton.textContent = state.goalReached ? "开始点将" : "开始点将（当前不足）";
    this.removeTodaySponsorsButton.disabled = !canManage || state.programQueue.length === 0;
    this.deleteRoomButton.disabled = !canManage || !this.roomSelect.value;
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

  private async loadRooms(): Promise<boolean> {
    this.rooms = await this.apiClient.getRooms();
    const currentSlug = RoomContext.fromPath(window.location.pathname).slug;
    const selectedSlug = preferredRoomSlug(this.rooms, currentSlug, savedRoomSlug(window.localStorage));

    if (selectedSlug !== currentSlug && selectedSlug !== "default") {
      rememberRoomSlug(window.localStorage, selectedSlug);
      window.location.replace(roomPagePath(selectedSlug, "admin"));
      return true;
    }

    rememberRoomSlug(window.localStorage, selectedSlug);
    renderRoomOptions(this.roomSelect, this.rooms, selectedSlug);
    return false;
  }

  private changeRoom(): void {
    const slug = this.roomSelect.value;
    if (!slug) {
      return;
    }

    rememberRoomSlug(window.localStorage, slug);
    window.location.href = roomPagePath(slug, "admin");
  }

  private async createRoom(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const room = await this.apiClient.createRoom(this.roomNameInput.value);
    this.roomNameInput.value = "";
    rememberRoomSlug(window.localStorage, room.slug);
    window.location.href = roomPagePath(room.slug, "admin");
  }

  private async deleteSelectedRoom(): Promise<void> {
    const slug = this.roomSelect.value;
    if (!slug || !window.confirm("确认删除这个房间吗？历史数据会保留，只从选择器隐藏。")) {
      return;
    }

    this.rooms = await this.apiClient.deleteRoom(slug);
    window.localStorage.removeItem(SELECTED_ROOM_STORAGE_KEY);
    const nextRoom = this.rooms[0];
    window.location.href = nextRoom ? roomPagePath(nextRoom.slug, "admin") : "/admin.html";
  }

  private applyRole(): void {
    const canAdd = this.session?.role === "viewer" || this.session?.role === "admin";
    const canOperate = canAdd;
    const canManage = this.session?.role === "admin";
    this.sponsorForm.setEnabled(canAdd);
    this.targetForm.setEnabled(canOperate);
    this.recordListView.setCanManage(canManage);
    this.roomForm.querySelectorAll<HTMLInputElement | HTMLButtonElement>("input, button").forEach((element) => {
      element.disabled = !canManage;
    });
    this.deleteRoomButton.disabled = !canManage || !this.roomSelect.value;
    this.logoutButton.disabled = !this.session;
    this.authStatus.textContent = this.session
      ? this.session.role === "admin"
        ? "超级权限"
        : "普通权限"
      : "未登录";
  }
}
