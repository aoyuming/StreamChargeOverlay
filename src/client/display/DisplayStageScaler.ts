const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1440;
const PREVIEW_FIT_CLASS = "is-preview-fit";

type StageRoot = {
  classList: {
    add(value: string): void;
    remove(value: string): void;
  };
  style: {
    setProperty(name: string, value: string): void;
  };
};

type StageViewport = {
  innerWidth: number;
  innerHeight: number;
  addEventListener(event: "resize", listener: () => void): void;
  removeEventListener(event: "resize", listener: () => void): void;
};

// Keeps the OBS canvas native, while making ordinary browser previews fit.
export class DisplayStageScaler {
  private readonly applyScale = (): void => {
    const scale = Math.min(1, this.viewport.innerWidth / STAGE_WIDTH, this.viewport.innerHeight / STAGE_HEIGHT);
    const offsetX = Math.max(0, Math.round((this.viewport.innerWidth - STAGE_WIDTH * scale) / 2));

    this.root.style.setProperty("--stage-scale", scale.toFixed(4));
    this.root.style.setProperty("--stage-offset-x", `${offsetX}px`);

    if (scale < 1) {
      this.root.classList.add(PREVIEW_FIT_CLASS);
      return;
    }

    this.root.classList.remove(PREVIEW_FIT_CLASS);
  };

  public constructor(
    private readonly root: StageRoot,
    private readonly viewport: StageViewport
  ) {}

  public start(): () => void {
    this.applyScale();
    this.viewport.addEventListener("resize", this.applyScale);
    return () => this.viewport.removeEventListener("resize", this.applyScale);
  }
}
