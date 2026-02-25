export type WorkoutName = "Legs A" | "Legs B" | "Legs C" | "Session D";

export type BaseSchedule = Record<number, WorkoutName | "Rest">;

export type MuscleGroup =
  | "quads"
  | "hamstrings"
  | "calves"
  | "back"
  | "biceps"
  | "triceps"
  | "chest"
  | "shoulders";

export type BodySide = "front" | "back";

export type FatigueZone = "GREEN" | "YELLOW" | "RED";

export type WaveWeek = 1 | 2 | 3 | 4;

export type ExerciseMeta = {
  primaryGroup: MuscleGroup;
  groupContribution: Partial<Record<MuscleGroup, number>>;
  unilateral?: boolean;
  bodyweight?: boolean;
  minSets?: number;
  maxSets?: number;
};

export type WeeklyMuscleDose = Record<MuscleGroup, number>;

export type FatigueState = {
  score: number;
  zone: FatigueZone;
  reasons: string[];
  components: {
    rpe: number;
    repDropoff: number;
    performanceDecline: number;
    scheduleDisruption: number;
  };
};

export type WaveState = {
  week: WaveWeek;
  anchorDate: string;
  earlyPivot: boolean;
  isPivotWeek: boolean;
  notes: string[];
};

export type ProgressionState = {
  waveAnchorDate: string | null;
  earlyPivotActive: boolean;
};

export type MuscleTargetRange = {
  min: number;
  max: number;
};

export type MuscleHeatStatus = "NOT_TRAINED" | "UNDER" | "OPTIMAL" | "ABOVE_OPTIMAL";

export type MuscleHeatDatum = {
  group: MuscleGroup;
  dose: number;
  targetMin: number;
  targetMax: number;
  optimalPoint: number;
  status: MuscleHeatStatus;
  score: number;
  color: string;
};

export type MuscleContributor = {
  exercise: string;
  effectiveSets: number;
  sessionCount: number;
};

export type MuscleSessionItem = {
  date: string;
  exercise: string;
  effectiveSets: number;
};

export type BodyHeatmapState = {
  weekStart: string;
  weekEnd: string;
  muscles: Record<MuscleGroup, MuscleHeatDatum>;
  contributorsByMuscle: Record<MuscleGroup, MuscleContributor[]>;
  sessionsByMuscle: Record<MuscleGroup, MuscleSessionItem[]>;
};

export type SetLog = {
  reps: number;
  rpe: number;
  weight: number;
};

export type ExerciseConfig = {
  name: string;
  sets: number;
  repRange: [number, number];
  rest: string;
  restSeconds: number;
  video: string;
  notes: string;
};

export type WorkoutEntry = {
  date: string;
  workout: string;
  weight: number;
  sets: SetLog[];
  notes: string;
};

export type WorkoutLogRecord = {
  date: string;
  workoutType: string;
  exercise: string;
  data: WorkoutEntry;
};

export type SkippedSession = {
  date: string;
  workout: string;
  action: "push" | "skip";
};

export type SkippedExercise = {
  date: string;
  workout: string;
  exercise: string;
  reason: "notes_skip";
};

export type MeasurementEntry = {
  date: string;
  bodyWeight: number;
  leftThigh: number;
  rightThigh: number;
  leftCalf: number;
  rightCalf: number;
  notes: string;
};

export type Logs = {
  workouts: WorkoutLogRecord[];
  exercises: Record<string, WorkoutEntry[]>;
  skippedSessions: SkippedSession[];
  skippedExercises: SkippedExercise[];
  measurements: MeasurementEntry[];
  scheduleOffset: number;
};

export type Settings = {
  mealPlan: string;
  holidayMode: boolean;
  holidayStart: string | null;
  scheduleOffset: number;
  progressionState: ProgressionState;
};

export type WeeklyBucket = {
  sessions: number;
  sets: number;
  volume: number;
  rpeSum: number;
  rpeCount: number;
  e1rmSum: number;
  avgRpe: number;
  avgE1rm: number;
};

export type WeeklyReview = {
  recent: WeeklyBucket;
  previous: WeeklyBucket;
};

export type StreakStats = {
  currentStreakWeeks: number;
  longestStreakWeeks: number;
  totalWeeksTrained: number;
  consistencyPercent: number;
  workoutsThisWeek: number;
  targetWorkoutsWeek: number;
};

export type TargetRecommendation =
  | "PROGRESS"
  | "PUSH"
  | "BUILD"
  | "CONSOLIDATE"
  | "DELOAD"
  | "BASELINE"
  | "NORMAL"
  | "VOLUME"
  | "LIGHT_RETURN"
  | "REACCLIMATION"
  | "REBUILDING"
  | "FRESH_START";

export type TrendTag = "IMPROVING" | "DECLINING" | "STABLE" | "VARIABLE" | "NO_DATA";

export type TrendInfo = {
  hasData: boolean;
  trend: TrendTag;
  avgE1rm: number | null;
  avgReps: number | null;
  avgRpe: number | null;
  e1rmTrend: number;
  repTrend: number;
  rpeTrend: number;
  sessionsAnalyzed: number;
};

export type SessionStats = {
  sets: SetLog[];
  topWeight: number;
  topSetReps: number;
  topSetRpe: number;
  backoffSets: number;
  backoffAvgReps: number;
  backoffMinReps: number;
  backoffAvgRpe: number;
  backoffRepDropoff: number;
  avgReps: number;
  minReps: number;
  maxReps: number;
  avgRpe: number;
  repDropoff: number;
  volume: number;
  bestE1rm: number;
  allSetsInRange: boolean;
};

export type NextTarget = {
  weight: number;
  repsPerSet: number;
  prescribedSets?: number;
  recommendation: TargetRecommendation;
  message: string;
  backoffWeight: number;
  backoffReps: number;
  backoffPercent: number;
  waveWeek?: WaveWeek;
  fatigueZone?: FatigueZone;
  adjustmentReasons?: string[];
  bodyweightUsed?: number;
  bodyweightStaleDays?: number | null;
  confidence?: number;
  isNew?: boolean;
  trendInfo?: TrendInfo | null;
  backoffNote?: string | null;
  previous?: string;
  suggestedExtraSets?: number;
  plateauInfo?: string | null;
  daysSinceLast?: number;
  lastWeight?: number;
  lastReps?: number[];
  lastRpe?: number;
  deloadPercent?: number;
};

export type WorkoutSummaryTarget = NextTarget & { exercise: ExerciseConfig };

export type AllTimeExerciseStats = {
  sessions: number;
  currentWeight: number;
  maxWeight: number;
  startingWeight: number;
  weightGain: number;
  totalVolume: number;
  avgReps: number;
};

export type AllTimeStats = {
  totalSessions: number;
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  firstWorkout: string | null;
  lastWorkout: string | null;
  exercises: Record<string, AllTimeExerciseStats>;
  prList: { exercise: string; weight: number }[];
};

export type SessionScheme = "Straight Sets" | "Top Set + Back-off";

export type ParsedPlanEntry = {
  exercise: string;
  sets: SetLog[];
  notes: string;
  skipped?: boolean;
};

export type ParsedPlan = {
  date: string | null;
  workout: string | null;
  entries: ParsedPlanEntry[];
  diagnostics?: {
    exerciseBlocks: number;
    parsedSetLines: number;
    skippedExercises: number;
    ignoredLines: string[];
  };
};
