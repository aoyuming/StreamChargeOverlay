export interface SponsorRecord {
  id: string;
  bossName: string;
  amount: number;
  programName: string;
  note: string;
  createdAt: number;
}

export interface AppState {
  targetAmount: number;
  slogan: string;
  sponsors: SponsorRecord[];
}

export interface SponsorRankingItem {
  bossName: string;
  totalAmount: number;
  recordCount: number;
  latestAt: number;
}

export interface DerivedAppState extends AppState {
  totalAmount: number;
  progressPercent: number;
  goalReached: boolean;
  ranking: SponsorRankingItem[];
  programQueue: SponsorRecord[];
  speechAlert?: SpeechAlert;
}

export interface SpeechAlert {
  id: string;
  url: string;
  text: string;
  createdAt: number;
}

export interface AddSponsorRequest {
  bossName: string;
  amount: number;
  programName: string;
  note?: string;
}

export interface UpdateTargetRequest {
  targetAmount: number;
}

export interface UpdateSettingsRequest {
  targetAmount: number;
  slogan: string;
}

export interface StateRepository {
  load(): Promise<AppState>;
  save(state: AppState): Promise<void>;
}

export interface ApiErrorResponse {
  error: string;
}
