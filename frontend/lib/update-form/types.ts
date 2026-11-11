export type QuestionType = "scale" | "text" | "number" | "yes_no" | "chips" | "auto" | "photos";

export type Condition =
  | { questionId: string | null; op: "<" | "<=" | "=" | ">=" | ">"; value: number }
  | { questionId: string | null; op: "is"; value: boolean }
  | { questionId: string | null; op: "includes"; value: string };

export interface Question {
  id: string;
  code: string;
  shortLabel: string;
  label: string;
  help?: string;
  type: QuestionType;
  required: boolean;
  showToCoach: boolean;
  scored?: boolean;
  weight?: number;
  showIf?: Condition;
  scaleLabels?: [string, string, string, string, string];
  display?: "buttons" | "numbers" | "stars";
  unit?: string;
  decimals?: number;
  min?: number;
  max?: number;
  showDelta?: boolean;
  options?: string[];
  multi?: boolean;
  withText?: boolean;
  autoSource?: "workouts_week" | "last_weight" | "plan_kcal";
  photoSlots?: string[];
  placeholder?: string;
}

export interface Step { id: string; title: string; icon: string; questions: Question[] }
export interface ScoreTier { min: number; max: number; title: string; message: string }
export interface FormDefinition {
  steps: Step[];
  scoreTiers: ScoreTier[];
  scoreNote: string;
  settings: { deadlineTime: string; allowedDays: number[]; photosRequired: boolean; showScoreToClient: boolean };
}
export type Answers = Record<string, unknown>;
