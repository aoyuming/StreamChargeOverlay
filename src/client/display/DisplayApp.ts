import type { DerivedAppState } from "../../shared/types";
import { ApiClient } from "../common/ApiClient";
import { queryRequired } from "../common/dom";
import { RealtimeClient } from "../common/RealtimeClient";
import { ProgressEffectLayer } from "./ProgressEffectLayer";
import { ProgressPanel } from "./ProgressPanel";
import { RankingTicker } from "./RankingTicker";
import { BurstParticles } from "./BurstParticles";
import { DisplayEffectCoordinator } from "./DisplayEffectCoordinator";
import { StageEffectLayer, type StageEffectPlayer } from "./StageEffectLayer";
import { SponsorBurst } from "./SponsorBurst";
import { SponsorSound } from "./SponsorSound";
import { SponsorSpeech } from "./SponsorSpeech";
import { SponsorSpeechAudio } from "./SponsorSpeechAudio";

export class DisplayApp {
  private readonly progressPanel: ProgressPanel;
  private readonly rankingTicker: RankingTicker;
  private readonly sponsorBurst: SponsorBurst;
  private readonly stageEffects: StageEffectPlayer;
  private readonly effectCoordinator = new DisplayEffectCoordinator();
  private readonly sponsorSound = new SponsorSound();
  private readonly sponsorSpeech = new SponsorSpeech();
  private readonly sponsorSpeechAudio = new SponsorSpeechAudio();

  public constructor(
    private readonly apiClient: ApiClient,
    private readonly realtimeClient: RealtimeClient,
    stageEffects?: StageEffectPlayer
  ) {
    this.progressPanel = new ProgressPanel(
      queryRequired("#currentBossList"),
      queryRequired("#progressTrack"),
      queryRequired("#progressFill"),
      queryRequired("#progressSlogan"),
      queryRequired("#progressPercent"),
      new ProgressEffectLayer(queryRequired("#progressEffectsCanvas"))
    );
    this.rankingTicker = new RankingTicker(queryRequired("#rankingPinned"), queryRequired("#rankingList"));
    this.sponsorBurst = new SponsorBurst(
      queryRequired("#sponsorBurst"),
      queryRequired("#burstAvatar"),
      queryRequired("#burstTitle"),
      queryRequired("#burstNote"),
      new BurstParticles(queryRequired("#burstParticles"))
    );
    this.stageEffects = stageEffects ?? new StageEffectLayer(queryRequired("#stageEffectsCanvas"));
  }

  public async start(): Promise<void> {
    this.realtimeClient.onStateUpdated((state) => this.render(state));
    this.render(await this.apiClient.getState());
  }

  private render(state: DerivedAppState): void {
    const effectEvent = this.effectCoordinator.update(state);
    this.progressPanel.render(state, state.programQueue);
    this.rankingTicker.render(state.ranking);

    if (effectEvent.shouldPlayDianjiangEffect) {
      this.stageEffects.playDianjiangEffect();
    }

    if (effectEvent.latestNewSponsor) {
      if (effectEvent.shouldPulseProgress) {
        this.progressPanel.pulse();
      }
      if (effectEvent.sponsorEffect) {
        this.stageEffects.playSponsorEffect(effectEvent.sponsorEffect);
      }
      this.sponsorBurst.show(effectEvent.latestNewSponsor);
      void this.sponsorSound.play();
      if (state.speechAlert) {
        this.sponsorSpeechAudio.play(state.speechAlert);
      } else {
        this.sponsorSpeech.speak(effectEvent.latestNewSponsor);
      }
      document.body.classList.add("has-new-sponsor");
      window.setTimeout(() => document.body.classList.remove("has-new-sponsor"), 900);
    }
  }
}
