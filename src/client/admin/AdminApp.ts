import type { DerivedAppState } from "../../shared/types";
import { ApiClient } from "../common/ApiClient";
import { queryRequired } from "../common/dom";
import { RealtimeClient } from "../common/RealtimeClient";
import { AdminSummaryView } from "./AdminSummaryView";
import { RecordListView } from "./RecordListView";
import { SponsorFormController } from "./SponsorFormController";
import { TargetFormController } from "./TargetFormController";

export class AdminApp {
  private readonly sponsorForm: SponsorFormController;
  private readonly targetForm: TargetFormController;
  private readonly summaryView: AdminSummaryView;
  private readonly recordListView: RecordListView;

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
  }

  public async start(): Promise<void> {
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

    this.recordListView.onDelete(async (id) => {
      await this.apiClient.deleteSponsor(id);
    });

    this.realtimeClient.onStateUpdated((state) => this.render(state));
    this.render(await this.apiClient.getState());
  }

  private render(state: DerivedAppState): void {
    this.summaryView.render(state);
    this.recordListView.render(state.sponsors);
  }
}
