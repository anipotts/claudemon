export type ThreatLevel = "safe" | "suspicious" | "likely_attack" | "blocked";

export type AttackCategory =
  | "cot_elicitation"
  | "capability_mapping"
  | "safety_boundary"
  | "tool_use_extraction"
  | "reward_model_grading"
  | "censorship_rewrite";

export type MetaSignal =
  | "high_volume"
  | "uniform_coverage"
  | "template_reuse"
  | "multilingual_systematic"
  | "rigid_format";

export interface ThreatEvent {
  id: string;
  input: string;
  response: string;
  threatLevel: ThreatLevel;
  threatScore: number;
  category: AttackCategory | null;
  categoryDescription?: string;
  signals: string[];
  metaSignals: MetaSignal[];
  timestamp: Date;
  stage2Verdict?: "ATTACK" | "BENIGN";
  stage2Model?: string;
  twoStage?: boolean;
  topMatches?: { category: string; similarity: number }[];
  categoryScores?: Record<string, number>;
  latencyMs?: number;
}

export interface FlaggedFile {
  name: string;
  threatLevel: ThreatLevel;
  category: string;
  score: number;
}

export interface Stats {
  total: number;
  safe: number;
  suspicious: number;
  likely_attack: number;
  blocked: number;
  byCategory: Record<AttackCategory, number>;
  byMetaSignal: Record<MetaSignal, number>;
}

export const CATEGORY_LABELS: Record<AttackCategory, string> = {
  cot_elicitation: "Chain-of-Thought Elicitation",
  capability_mapping: "Capability Mapping",
  safety_boundary: "Safety Boundary Probing",
  tool_use_extraction: "Tool Use Extraction",
  reward_model_grading: "Reward Model Grading",
  censorship_rewrite: "Censorship Rewrite",
};

export const THREAT_COLORS: Record<ThreatLevel, string> = {
  safe: "var(--safe)",
  suspicious: "var(--suspicious)",
  likely_attack: "var(--attack)",
  blocked: "var(--blocked)",
};

export const THREAT_LABELS: Record<ThreatLevel, string> = {
  safe: "SAFE",
  suspicious: "SUSPICIOUS",
  likely_attack: "LIKELY ATTACK",
  blocked: "BLOCKED",
};

export const LOG_PREFIXES: Record<ThreatLevel, string> = {
  safe: "[green]  ",
  suspicious: "[yellow] ",
  likely_attack: "[red]    ",
  blocked: "[block]  ",
};

export const INITIAL_STATS: Stats = {
  total: 0,
  safe: 0,
  suspicious: 0,
  likely_attack: 0,
  blocked: 0,
  byCategory: {
    cot_elicitation: 0,
    capability_mapping: 0,
    safety_boundary: 0,
    tool_use_extraction: 0,
    reward_model_grading: 0,
    censorship_rewrite: 0,
  },
  byMetaSignal: {
    high_volume: 0,
    uniform_coverage: 0,
    template_reuse: 0,
    multilingual_systematic: 0,
    rigid_format: 0,
  },
};

export const INITIAL_FLAGGED_FILES: FlaggedFile[] = [];
