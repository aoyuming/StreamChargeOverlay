import type { DerivedAppState } from "../../shared/types";
import { ApiClient } from "../common/ApiClient";
import { queryRequired } from "../common/dom";
import { RealtimeClient } from "../common/RealtimeClient";
import { ProgressEffectLayer } from "./ProgressEffectLayer";
import { ProgressPanel } from "./ProgressPanel";
import { RankingTicker } from "./RankingTicker";
import { BurstParticles } from "./BurstParticles";
import { SponsorBurst } from "./SponsorBurst";
import { SponsorSound } from "./SponsorSound";
import { SponsorSpeech } from "./SponsorSpeech";
import { SponsorSpeechAudio } from "./SponsorSpeechAudio";
import { TodayRankingTicker } from "./TodayRankingTicker";
import { buildTodayRanking } from "./todayRanking";

export class DisplayApp {
  private readonly progressPanel: ProgressPanel;
  private readonly todayRankingTicker: TodayRankingTicker;
  private readonly rankingTicker: RankingTicker;
  private readonly sponsorBurst: SponsorBurst;
  private readonly sponsorSound = new SponsorSound();
  private readonly sponsorSpeech = new SponsorSpeech();
  private readonly sponsorSpeechAudio = new SponsorSpeechAudio();
  private knownSponsorIds = new Set<string>();
  private lastTotalAmount = 0;
  private hasRendered = false;

  public constructor(
    private readonly apiClient: ApiClient,
    private readonly realtimeClient: RealtimeClient
  ) {
    this.progressPanel = new ProgressPanel(
      queryRequired("#currentBossList"),
      queryRequired("#progressTrack"),
      queryRequired("#progressFill"),
      queryRequired("#progressSlogan"),
      queryRequired("#progressPercent"),
      new ProgressEffectLayer(queryRequired("#progressEffectsCanvas"))
    );
    this.todayRankingTicker = new TodayRankingTicker(
      queryRequired("#todayRankingPinned"),
      queryRequired("#todayRankingList")
    );
    this.rankingTicker = new RankingTicker(queryRequired("#rankingPinned"), queryRequired("#rankingList"));
    this.sponsorBurst = new SponsorBurst(
      queryRequired("#sponsorBurst"),
      queryRequired("#burstTitle"),
      queryRequired("#burstNote"),
      new BurstParticles(queryRequired("#burstParticles"))
    );
  }

  public async start(): Promise<void> {
    this.realtimeClient.onStateUpdated((state) => this.render(state));
    this.render(await this.apiClient.getState());
  }

  private render(state: DerivedAppState): void {
    const shouldPulse = state.totalAmount > this.lastTotalAmount;
    const latestNewSponsor = this.findLatestNewSponsor(state);
    this.progressPanel.render(state, state.sponsors);
    this.todayRankingTicker.render(buildTodayRanking(state.sponsors));
    this.rankingTicker.render(state.ranking);

    if (shouldPulse && this.lastTotalAmount > 0) {
      this.progressPanel.pulse();
      if (latestNewSponsor) {
        this.sponsorBurst.show(latestNewSponsor);
        void this.sponsorSound.play();
        if (state.speechAlert) {
          this.sponsorSpeechAudio.play(state.speechAlert);
        } else {
          this.sponsorSpeech.speak(latestNewSponsor);
        }
      }
      document.body.classList.add("has-new-sponsor");
      window.setTimeout(() => document.body.classList.remove("has-new-sponsor"), 900);
    }

    this.knownSponsorIds = new Set(state.sponsors.map((record) => record.id));
    this.lastTotalAmount = state.totalAmount;
    this.hasRendered = true;
  }

  private findLatestNewSponsor(state: DerivedAppState) {
    if (!this.hasRendered) {
      return undefined;
    }

    return state.sponsors
      .filter((record) => !this.knownSponsorIds.has(record.id))
      .sort((left, right) => right.createdAt - left.createdAt)[0];
  }

}
