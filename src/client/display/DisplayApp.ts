import type { DerivedAppState } from "../../shared/types";
import { ApiClient } from "../common/ApiClient";
import { queryRequired } from "../common/dom";
import { RealtimeClient } from "../common/RealtimeClient";
import { ProgressEffectLayer } from "./ProgressEffectLayer";
import { ProgressPanel } from "./ProgressPanel";
import { RankingTicker } from "./RankingTicker";
import { BurstParticles } from "./BurstParticles";
import { DisplayEffectCoordinator } from "./DisplayEffectCoordinator";
import { ShaderStageEffectLayer } from "./ShaderStageEffectLayer";
import { STAGE_EFFECT_DURATION_MS, StageEffectLayer, type StageEffectPlayer } from "./StageEffectLayer";
import { SponsorBurst } from "./SponsorBurst";
import { SponsorSound } from "./SponsorSound";
import { SponsorSpeech } from "./SponsorSpeech";
import { SponsorSpeechAudio } from "./SponsorSpeechAudio";

export class DisplayApp {
  private readonly progressPanel: ProgressPanel;
  private readonly rankingTicker: RankingTicker;
  private readonly sponsorBurst: SponsorBurst;
  private readonly stageEffects: StageEffectPlayer;
  private effectCoordinator = new DisplayEffectCoordinator();
  private readonly sponsorSound = new SponsorSound();
  private readonly sponsorSpeech = new SponsorSpeech();
  private readonly sponsorSpeechAudio = new SponsorSpeechAudio();
  private sourceId = 0;
  private dianjiangTextTimer = 0;

  public constructor(
    private apiClient: ApiClient,
    private realtimeClient: RealtimeClient,
    stageEffects?: StageEffectPlayer
  ) {
    this.progressPanel = new ProgressPanel(
      queryRequired("#currentBossList"),
      queryRequired("#progressTrack"),
      queryRequired("#progressFill"),
      queryRequired("#progressSlogan"),
      queryRequired("#progressPercent"),
      this.createProgressEffectLayer()
    );
    this.rankingTicker = new RankingTicker(queryRequired("#rankingPinned"), queryRequired("#rankingList"));
    this.sponsorBurst = new SponsorBurst(
      queryRequired("#sponsorBurst"),
      queryRequired("#burstAvatar"),
      queryRequired("#burstTitle"),
      queryRequired("#burstProgram"),
      queryRequired("#burstNote"),
      new BurstParticles(queryRequired("#burstParticles"))
    );
    this.stageEffects = stageEffects ?? this.createStageEffectLayer();
  }

  public async start(): Promise<void> {
    const sourceId = ++this.sourceId;
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

  public async switchDataSource(apiClient: ApiClient, realtimeClient: RealtimeClient): Promise<void> {
    this.realtimeClient.disconnect();
    this.apiClient = apiClient;
    this.realtimeClient = realtimeClient;
    this.effectCoordinator = new DisplayEffectCoordinator();
    await this.start();
  }

  private render(state: DerivedAppState): void {
    const effectEvent = this.effectCoordinator.update(state);
    this.progressPanel.render(state, state.programQueue);
    this.rankingTicker.render(state.ranking);

    if (effectEvent.shouldPlayDianjiangEffect) {
      this.playDianjiangEffect();
    }

    if (effectEvent.latestNewSponsor) {
      if (effectEvent.shouldPulseProgress) {
        this.progressPanel.pulse();
      }
      if (effectEvent.sponsorEffect) {
        this.stageEffects.playSponsorEffect(effectEvent.sponsorEffect);
      }
      this.sponsorBurst.show(effectEvent.latestNewSponsor, state.speechAlert?.text);
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

  private createProgressEffectLayer() {
    return new ProgressEffectLayer(queryRequired("#progressEffectsCanvas"));
  }

  private createStageEffectLayer(): StageEffectPlayer {
    const canvasStageEffects = new StageEffectLayer(queryRequired("#stageEffectsCanvas"));
    return ShaderStageEffectLayer.create(queryRequired("#stageShaderEffectsCanvas"), canvasStageEffects) ?? canvasStageEffects;
  }

  private playDianjiangEffect(): void {
    window.clearTimeout(this.dianjiangTextTimer);
    this.stageEffects.playDianjiangEffect();
    document.body.classList.add("has-dianjiang-effect");
    this.dianjiangTextTimer = window.setTimeout(
      () => document.body.classList.remove("has-dianjiang-effect"),
      STAGE_EFFECT_DURATION_MS
    );
  }
}
