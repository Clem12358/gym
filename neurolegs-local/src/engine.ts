import {
  BODY_HEATMAP_COLORS,
  BACKOFF_MAX_PERCENT,
  BACKOFF_MIN_PERCENT,
  BACKOFF_PERCENT,
  BASE_SCHEDULE,
  COMPOUND_EXERCISES,
  DELOAD_RPE,
  EXERCISE_META,
  EXERCISES,
  FIXED_EXERCISE_WEIGHTS_KG,
  KG_TO_LB,
  LB_TO_KG,
  MACHINE_STACK_BASE_KG,
  MACHINE_STACK_EXERCISES,
  MACHINE_STACK_MAX_KG,
  MACHINE_STACK_MICRO_LB,
  MACHINE_STACK_STEP_KG,
  MAX_RPE,
  MUSCLE_GROUP_ORDER,
  MUSCLE_TARGET_RANGES,
  STARTING_WEIGHTS,
  TARGET_RPE,
  USER_PROFILE,
  WEIGHT_INCREMENT,
} from "./constants";
import type {
  AllTimeStats,
  BodyHeatmapState,
  FatigueState,
  ExerciseConfig,
  ExerciseMeta,
  Logs,
  MeasurementEntry,
  MuscleContributor,
  MuscleHeatDatum,
  MuscleHeatStatus,
  MuscleGroup,
  MuscleSessionItem,
  NextTarget,
  SessionStats,
  SetLog,
  Settings,
  StreakStats,
  TrendInfo,
  WaveState,
  WeeklyMuscleDose,
  WeeklyReview,
  WorkoutEntry,
  WorkoutName,
  WorkoutSummaryTarget,
} from "./types";

const TARGET_WORKOUTS_WEEK = Object.values(BASE_SCHEDULE).filter((workout) => workout !== "Rest").length;

type MuscleAdjustmentAction = "increase" | "hold" | "decrease";

type MuscleAdjustment = {
  action: MuscleAdjustmentAction;
  currentDose: number;
  targetMin: number;
  targetMax: number;
};

type BodyweightResolution = {
  bodyWeight: number;
  staleDays: number | null;
  source: "measurement" | "profile";
  date: string | null;
};

type ProgrammingState = {
  wave: WaveState;
  fatigue: FatigueState;
  muscleDose: WeeklyMuscleDose;
  muscleAdjustments: Record<MuscleGroup, MuscleAdjustment>;
  bodyweightStatus: BodyweightResolution;
};

type MuscleRangeAggregation = {
  dose: WeeklyMuscleDose;
  contributorsByMuscle: Record<MuscleGroup, Map<string, { effectiveSets: number; sessionCount: number }>>;
  sessionsByMuscle: Record<MuscleGroup, Map<string, MuscleSessionItem>>;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number): number {
  return Number(value.toFixed(1));
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return d;
}

function formatYmd(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function emptyWeeklyMuscleDose(): WeeklyMuscleDose {
  return MUSCLE_GROUP_ORDER.reduce(
    (acc, group) => ({ ...acc, [group]: 0 }),
    {} as WeeklyMuscleDose,
  );
}

function fallbackExerciseMeta(exerciseName: string): ExerciseMeta {
  const lower = exerciseName.toLowerCase();
  if (lower.includes("leg") || lower.includes("squat") || lower.includes("thrust") || lower.includes("ham")) {
    if (lower.includes("calf")) {
      return { primaryGroup: "calves", groupContribution: { calves: 1 }, minSets: 2, maxSets: 5 };
    }
    if (lower.includes("curl") || lower.includes("ham") || lower.includes("rdl")) {
      return { primaryGroup: "hamstrings", groupContribution: { hamstrings: 1 }, minSets: 2, maxSets: 4 };
    }
    return { primaryGroup: "quads", groupContribution: { quads: 0.7, hamstrings: 0.3 }, minSets: 2, maxSets: 4 };
  }
  if (lower.includes("calf")) {
    return { primaryGroup: "calves", groupContribution: { calves: 1 }, minSets: 2, maxSets: 5 };
  }
  if (lower.includes("curl")) {
    return { primaryGroup: "biceps", groupContribution: { biceps: 1 }, minSets: 2, maxSets: 4 };
  }
  if (lower.includes("triceps") || lower.includes("pushdown") || lower.includes("extension")) {
    return { primaryGroup: "triceps", groupContribution: { triceps: 1 }, minSets: 2, maxSets: 4 };
  }
  if (lower.includes("lat") || lower.includes("row") || lower.includes("pull")) {
    return { primaryGroup: "back", groupContribution: { back: 0.75, biceps: 0.25 }, minSets: 2, maxSets: 4 };
  }
  if (lower.includes("press") || lower.includes("pec")) {
    return { primaryGroup: "chest", groupContribution: { chest: 0.8, triceps: 0.2 }, minSets: 2, maxSets: 4 };
  }
  if (lower.includes("lateral") || lower.includes("rear")) {
    return { primaryGroup: "shoulders", groupContribution: { shoulders: 1 }, minSets: 2, maxSets: 4 };
  }
  return { primaryGroup: "quads", groupContribution: { quads: 0.7, hamstrings: 0.3 }, minSets: 2, maxSets: 4 };
}

function getExerciseMeta(exerciseName: string): ExerciseMeta {
  return EXERCISE_META[exerciseName] ?? fallbackExerciseMeta(exerciseName);
}

function getHardSetFactor(set: SetLog): number {
  if (set.reps <= 0) {
    return 0;
  }
  if (set.rpe >= 8) {
    return 1;
  }
  if (set.rpe >= 7) {
    return 0.9;
  }
  if (set.rpe >= 6) {
    return 0.75;
  }
  return 0.5;
}

function getClosestMeasurementForDate(dateStr: string, measurements: MeasurementEntry[]): MeasurementEntry | null {
  const targetDate = parseLogDate(dateStr);
  if (!targetDate || !measurements.length) {
    return null;
  }

  const withDate = measurements
    .map((m) => ({ entry: m, date: parseLogDate(m.date) }))
    .filter((item): item is { entry: MeasurementEntry; date: Date } => item.date instanceof Date);

  if (!withDate.length) {
    return null;
  }

  const beforeOrEqual = withDate
    .filter((item) => item.date.getTime() <= targetDate.getTime())
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  if (beforeOrEqual.length) {
    return beforeOrEqual[0].entry;
  }

  withDate.sort((a, b) => Math.abs(a.date.getTime() - targetDate.getTime()) - Math.abs(b.date.getTime() - targetDate.getTime()));
  return withDate[0].entry;
}

function resolveBodyweightForDate(dateStr: string, measurements: MeasurementEntry[]): BodyweightResolution {
  const fallback = USER_PROFILE.weightKg;
  if (!measurements.length) {
    return { bodyWeight: fallback, staleDays: null, source: "profile", date: null };
  }

  const selected = getClosestMeasurementForDate(dateStr, measurements);
  if (!selected) {
    return { bodyWeight: fallback, staleDays: null, source: "profile", date: null };
  }

  const selectedDate = parseLogDate(selected.date);
  const staleDays = selectedDate
    ? Math.floor((Date.now() - selectedDate.getTime()) / (24 * 60 * 60 * 1000))
    : null;

  return {
    bodyWeight: selected.bodyWeight || fallback,
    staleDays,
    source: "measurement",
    date: selected.date,
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const normalized = value.length === 3
    ? value.split("").map((c) => `${c}${c}`).join("")
    : value;
  const int = Number.parseInt(normalized, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return [r, g, b];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clampColor = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  const toHex = (value: number) => clampColor(value).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function interpolateHexColor(startHex: string, endHex: string, ratio: number): string {
  const t = clamp(ratio, 0, 1);
  const [r1, g1, b1] = hexToRgb(startHex);
  const [r2, g2, b2] = hexToRgb(endHex);
  return rgbToHex(
    r1 + (r2 - r1) * t,
    g1 + (g2 - g1) * t,
    b1 + (b2 - b1) * t,
  );
}

function emptyMuscleContributorMaps(): Record<MuscleGroup, Map<string, { effectiveSets: number; sessionCount: number }>> {
  return MUSCLE_GROUP_ORDER.reduce((acc, group) => {
    acc[group] = new Map<string, { effectiveSets: number; sessionCount: number }>();
    return acc;
  }, {} as Record<MuscleGroup, Map<string, { effectiveSets: number; sessionCount: number }>>);
}

function emptyMuscleSessionMaps(): Record<MuscleGroup, Map<string, MuscleSessionItem>> {
  return MUSCLE_GROUP_ORDER.reduce((acc, group) => {
    acc[group] = new Map<string, MuscleSessionItem>();
    return acc;
  }, {} as Record<MuscleGroup, Map<string, MuscleSessionItem>>);
}

function aggregateMuscleDoseForRange(logs: Logs, start: Date, end: Date): MuscleRangeAggregation {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  const dose = emptyWeeklyMuscleDose();
  const contributorsByMuscle = emptyMuscleContributorMaps();
  const sessionsByMuscle = emptyMuscleSessionMaps();

  const applyEntryContribution = (exerciseName: string, entry: Partial<WorkoutEntry>, dateOverride?: string): number => {
    const entryDateRaw = dateOverride ?? entry.date ?? "";
    const entryDate = parseLogDate(entryDateRaw);
    if (!entryDate) {
      return 0;
    }
    const ts = entryDate.getTime();
    if (ts < startMs || ts > endMs) {
      return 0;
    }

    const sets = getSessionSets(entry);
    if (!sets.length) {
      return 0;
    }

    const meta = getExerciseMeta(exerciseName);
    const effectiveSets = sets.reduce((sum, set) => sum + getHardSetFactor(set), 0) * (meta.unilateral ? 2 : 1);
    if (effectiveSets <= 0) {
      return 0;
    }

    const day = entryDateRaw.slice(0, 10) || formatYmd(entryDate);
    for (const [group, weight] of Object.entries(meta.groupContribution)) {
      const contribution = effectiveSets * (weight ?? 0);
      if (contribution <= 0) {
        continue;
      }

      const muscle = group as MuscleGroup;
      dose[muscle] += contribution;

      const existingContributor = contributorsByMuscle[muscle].get(exerciseName);
      if (existingContributor) {
        existingContributor.effectiveSets += contribution;
        existingContributor.sessionCount += 1;
      } else {
        contributorsByMuscle[muscle].set(exerciseName, {
          effectiveSets: contribution,
          sessionCount: 1,
        });
      }

      const sessionKey = `${day}|${exerciseName}`;
      const existingSession = sessionsByMuscle[muscle].get(sessionKey);
      if (existingSession) {
        existingSession.effectiveSets += contribution;
      } else {
        sessionsByMuscle[muscle].set(sessionKey, {
          date: day,
          exercise: exerciseName,
          effectiveSets: contribution,
        });
      }
    }

    return 1;
  };

  let processed = 0;
  for (const [exerciseName, history] of Object.entries(logs.exercises)) {
    for (const entry of history) {
      processed += applyEntryContribution(exerciseName, entry);
    }
  }

  // Fallback for imports that populate workouts but leave exercises sparse.
  if (processed === 0) {
    for (const workout of logs.workouts) {
      const exerciseName = workout.exercise || workout.data?.workout;
      if (!exerciseName) {
        continue;
      }
      processed += applyEntryContribution(exerciseName, workout.data ?? {}, workout.date);
    }
  }

  return { dose, contributorsByMuscle, sessionsByMuscle };
}

function toHeatStatus(dose: number, min: number, max: number): MuscleHeatStatus {
  if (dose <= 0) {
    return "NOT_TRAINED";
  }
  if (dose > max) {
    return "ABOVE_OPTIMAL";
  }
  if (dose < min) {
    return "UNDER";
  }
  return "OPTIMAL";
}

function computeMuscleHeatScore(dose: number, min: number, max: number): number {
  if (dose <= 0) {
    return 0;
  }
  if (dose < min) {
    return round1(clamp((dose / Math.max(min, 1)) * 69, 1, 69));
  }
  if (dose <= max) {
    const zone = Math.max(max - min, 1);
    return round1(70 + clamp((dose - min) / zone, 0, 1) * 30);
  }
  const overRatio = clamp((dose - max) / Math.max(max * 0.5, 1), 0, 1);
  return round1(100 + overRatio * 40);
}

function computeMuscleHeatColor(dose: number, max: number): string {
  if (dose <= 0) {
    return BODY_HEATMAP_COLORS.notTrained;
  }
  if (dose <= max) {
    const readiness = clamp(dose / Math.max(max, 1), 0, 1);
    return interpolateHexColor(BODY_HEATMAP_COLORS.underMin, BODY_HEATMAP_COLORS.optimal, readiness);
  }
  const overRatio = clamp((dose - max) / Math.max(max * 0.5, 1), 0, 1);
  return interpolateHexColor(BODY_HEATMAP_COLORS.aboveMin, BODY_HEATMAP_COLORS.aboveMax, overRatio);
}

function buildMuscleHeatDatum(group: MuscleGroup, dose: number): MuscleHeatDatum {
  const range = MUSCLE_TARGET_RANGES[group];
  const normalizedDose = round1(dose);
  const status = toHeatStatus(normalizedDose, range.min, range.max);
  const optimalPoint = round1((range.min + range.max) / 2);
  return {
    group,
    dose: normalizedDose,
    targetMin: range.min,
    targetMax: range.max,
    optimalPoint,
    status,
    score: computeMuscleHeatScore(normalizedDose, range.min, range.max),
    color: computeMuscleHeatColor(normalizedDose, range.max),
  };
}

export function getCalendarWeekBounds(referenceDate = new Date()): { start: Date; end: Date } {
  const start = startOfWeek(referenceDate);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function computeMuscleDoseForDateRange(logs: Logs, start: Date, end: Date): WeeklyMuscleDose {
  const aggregation = aggregateMuscleDoseForRange(logs, start, end);
  return Object.fromEntries(
    Object.entries(aggregation.dose).map(([group, value]) => [group, round1(value)]),
  ) as WeeklyMuscleDose;
}

function computeWeeklyMuscleDose(logs: Logs, days = 7): WeeklyMuscleDose {
  const end = new Date();
  const cutoff = Date.now() - Math.max(0, days) * 24 * 60 * 60 * 1000;
  const start = new Date(cutoff);
  return computeMuscleDoseForDateRange(logs, start, end);
}

export function buildBodyHeatmapState(logs: Logs, referenceDate = new Date()): BodyHeatmapState {
  const { start, end } = getCalendarWeekBounds(referenceDate);
  const aggregation = aggregateMuscleDoseForRange(logs, start, end);

  const muscles = MUSCLE_GROUP_ORDER.reduce((acc, group) => {
    acc[group] = buildMuscleHeatDatum(group, aggregation.dose[group]);
    return acc;
  }, {} as Record<MuscleGroup, MuscleHeatDatum>);

  const contributorsByMuscle = MUSCLE_GROUP_ORDER.reduce((acc, group) => {
    const rows = Array.from(aggregation.contributorsByMuscle[group].entries())
      .map(([exercise, value]) => ({
        exercise,
        effectiveSets: round1(value.effectiveSets),
        sessionCount: value.sessionCount,
      } as MuscleContributor))
      .sort((a, b) => {
        if (b.effectiveSets !== a.effectiveSets) {
          return b.effectiveSets - a.effectiveSets;
        }
        return a.exercise.localeCompare(b.exercise);
      });
    acc[group] = rows;
    return acc;
  }, {} as Record<MuscleGroup, MuscleContributor[]>);

  const sessionsByMuscle = MUSCLE_GROUP_ORDER.reduce((acc, group) => {
    const rows = Array.from(aggregation.sessionsByMuscle[group].values())
      .map((item) => ({
        ...item,
        effectiveSets: round1(item.effectiveSets),
      } as MuscleSessionItem))
      .sort((a, b) => {
        if (a.date === b.date) {
          return b.effectiveSets - a.effectiveSets;
        }
        return b.date.localeCompare(a.date);
      });
    acc[group] = rows;
    return acc;
  }, {} as Record<MuscleGroup, MuscleSessionItem[]>);

  return {
    weekStart: formatYmd(start),
    weekEnd: formatYmd(end),
    muscles,
    contributorsByMuscle,
    sessionsByMuscle,
  };
}

function computeMuscleAdjustments(muscleDose: WeeklyMuscleDose): Record<MuscleGroup, MuscleAdjustment> {
  return Object.fromEntries(
    MUSCLE_GROUP_ORDER.map((group) => {
      const range = MUSCLE_TARGET_RANGES[group];
      const dose = muscleDose[group];
      let action: MuscleAdjustmentAction = "hold";
      if (dose < range.min - 0.5) {
        action = "increase";
      } else if (dose > range.max + 0.5) {
        action = "decrease";
      }
      return [
        group,
        {
          action,
          currentDose: dose,
          targetMin: range.min,
          targetMax: range.max,
        },
      ];
    }),
  ) as Record<MuscleGroup, MuscleAdjustment>;
}

function computeFatigueState(logs: Logs): FatigueState {
  const now = Date.now();
  const recentCutoff = now - 7 * 24 * 60 * 60 * 1000;
  const baselineCutoff = now - 28 * 24 * 60 * 60 * 1000;

  const recentRpe: number[] = [];
  const baselineRpe: number[] = [];
  const recentDropoff: number[] = [];
  const baselineDropoff: number[] = [];
  const recentE1rm: number[] = [];
  const baselineE1rm: number[] = [];

  Object.values(logs.exercises).forEach((history) => {
    history.forEach((entry) => {
      const entryDate = parseLogDate(entry.date);
      if (!entryDate) {
        return;
      }
      const ts = entryDate.getTime();
      const sets = getSessionSets(entry);
      if (!sets.length) {
        return;
      }

      const targetRpe = sets.map((s) => s.rpe);
      const reps = sets.map((s) => s.reps);
      const bestE1rm = Math.max(...sets.map((s) => estimateE1rm(s.weight, s.reps, s.rpe)));
      const dropoff = Math.max(...reps) - Math.min(...reps);

      if (ts >= recentCutoff) {
        recentRpe.push(...targetRpe);
        recentDropoff.push(dropoff);
        recentE1rm.push(bestE1rm);
      } else if (ts >= baselineCutoff) {
        baselineRpe.push(...targetRpe);
        baselineDropoff.push(dropoff);
        baselineE1rm.push(bestE1rm);
      }
    });
  });

  const avg = (arr: number[], fallback: number) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : fallback);
  const recentAvgRpe = avg(recentRpe, TARGET_RPE);
  const baselineAvgRpe = avg(baselineRpe, TARGET_RPE);
  const recentAvgDropoff = avg(recentDropoff, 2);
  const baselineAvgDropoff = avg(baselineDropoff, 2);
  const recentAvgE1rm = avg(recentE1rm, 0);
  const baselineAvgE1rm = avg(baselineE1rm, recentAvgE1rm);

  const normRpe = clamp((recentAvgRpe - baselineAvgRpe) / 1.5, 0, 1);
  const normRepDropoff = clamp((recentAvgDropoff - (baselineAvgDropoff + 0.25)) / 3, 0, 1);
  const declinePct = baselineAvgE1rm > 0 ? (baselineAvgE1rm - recentAvgE1rm) / baselineAvgE1rm : 0;
  const normPerformanceDecline = clamp(declinePct / 0.08, 0, 1);

  const skippedCutoff = now - 14 * 24 * 60 * 60 * 1000;
  const skippedRecent = logs.skippedSessions.filter((s) => {
    const d = parseLogDate(s.date);
    return d ? d.getTime() >= skippedCutoff : false;
  }).length;

  const workoutDays = new Set(
    logs.workouts
      .map((w) => w.date.slice(0, 10))
      .filter((d) => {
        const parsed = parseLogDate(d);
        return parsed ? parsed.getTime() >= skippedCutoff : false;
      }),
  ).size;
  const expected = TARGET_WORKOUTS_WEEK * 2;
  const missed = Math.max(0, expected - workoutDays);
  const normScheduleDisruption = clamp((skippedRecent + missed) / 6, 0, 1);

  const score =
    40 * normRpe + 25 * normRepDropoff + 20 * normPerformanceDecline + 15 * normScheduleDisruption;

  let zone: FatigueState["zone"] = "GREEN";
  if (score > 60) {
    zone = "RED";
  } else if (score >= 35) {
    zone = "YELLOW";
  }

  const reasons: string[] = [];
  if (normRpe > 0.4) {
    reasons.push("Recent average RPE is trending above baseline.");
  }
  if (normRepDropoff > 0.4) {
    reasons.push("Set-to-set rep drop-off increased recently.");
  }
  if (normPerformanceDecline > 0.35) {
    reasons.push("Estimated performance trend is down vs baseline.");
  }
  if (normScheduleDisruption > 0.35) {
    reasons.push("Skipped/missed sessions are elevated in the last 2 weeks.");
  }

  return {
    score: round1(score),
    zone,
    reasons,
    components: {
      rpe: round1(normRpe),
      repDropoff: round1(normRepDropoff),
      performanceDecline: round1(normPerformanceDecline),
      scheduleDisruption: round1(normScheduleDisruption),
    },
  };
}

function resolveWaveState(logs: Logs, settings: Settings, fatigue: FatigueState): WaveState {
  const fromSettings = settings.progressionState?.waveAnchorDate
    ? parseLogDate(settings.progressionState.waveAnchorDate)
    : null;
  const earliestWorkout = logs.workouts
    .map((w) => parseLogDate(w.date))
    .filter((d): d is Date => d instanceof Date)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  const anchor = startOfWeek(fromSettings ?? earliestWorkout ?? new Date());
  const nowWeek = startOfWeek(new Date());
  const weeksSince = Math.max(0, Math.floor((nowWeek.getTime() - anchor.getTime()) / (7 * 24 * 60 * 60 * 1000)));
  const computedWeek = ((weeksSince % 4) + 1) as 1 | 2 | 3 | 4;
  const forcedEarlyPivot = Boolean(settings.progressionState?.earlyPivotActive) || fatigue.zone === "RED";
  const week = forcedEarlyPivot ? 4 : computedWeek;

  const notes: string[] = [];
  if (week === 2) {
    notes.push("Wave week 2: volume-friendly build week.");
  } else if (week === 3) {
    notes.push("Wave week 3: intensity focus, no extra set expansion.");
  } else if (week === 4) {
    notes.push("Wave week 4: pivot week with reduced set/load stress.");
  } else {
    notes.push("Wave week 1: baseline build week.");
  }
  if (forcedEarlyPivot) {
    notes.push("Early pivot active due to elevated global fatigue.");
  }

  return {
    week: week as 1 | 2 | 3 | 4,
    anchorDate: formatYmd(anchor),
    earlyPivot: forcedEarlyPivot,
    isPivotWeek: week === 4,
    notes,
  };
}

export function kgToLb(kg: number): number {
  return kg * KG_TO_LB;
}

export function lbToKg(lb: number): number {
  return lb * LB_TO_KG;
}

export function buildMachineStackWeights(maxKg = MACHINE_STACK_MAX_KG): number[] {
  const baseLb = kgToLb(MACHINE_STACK_BASE_KG);
  const stepLb = kgToLb(MACHINE_STACK_STEP_KG);
  const maxLb = kgToLb(maxKg);
  const optionsLb: number[] = [];

  let n = 0;
  while (true) {
    const base = baseLb + n * stepLb;
    if (base > maxLb + 1e-6) {
      break;
    }

    for (const micro of MACHINE_STACK_MICRO_LB) {
      const candidate = base + micro;
      if (candidate <= maxLb + 1e-6) {
        optionsLb.push(candidate);
      }
    }

    n += 1;
  }

  return Array.from(new Set(optionsLb.map((lb) => Number(lbToKg(lb).toFixed(2))))).sort((a, b) => a - b);
}

export const MACHINE_STACK_WEIGHTS = buildMachineStackWeights();

export function isMachineStackExercise(exerciseName: string): boolean {
  return MACHINE_STACK_EXERCISES.has(exerciseName);
}

export function snapMachineWeight(weightKg: number): number {
  if (!MACHINE_STACK_WEIGHTS.length) {
    return weightKg;
  }
  let best = MACHINE_STACK_WEIGHTS[0];
  for (const option of MACHINE_STACK_WEIGHTS) {
    if (Math.abs(option - weightKg) < Math.abs(best - weightKg)) {
      best = option;
    }
  }
  return best;
}

function getFixedExerciseWeights(exerciseName: string): number[] | null {
  const weights = FIXED_EXERCISE_WEIGHTS_KG[exerciseName];
  return Array.isArray(weights) && weights.length ? weights : null;
}

function snapFixedExerciseWeight(
  exerciseName: string,
  weightKg: number,
  strategy: "nearest" | "down" = "nearest",
): number {
  const options = getFixedExerciseWeights(exerciseName);
  if (!options) {
    return weightKg;
  }

  if (strategy === "down") {
    const belowOrEqual = options.filter((w) => w <= weightKg);
    if (belowOrEqual.length) {
      return Math.max(...belowOrEqual);
    }
    return options[0];
  }

  let best = options[0];
  for (const option of options) {
    const optionDist = Math.abs(option - weightKg);
    const bestDist = Math.abs(best - weightKg);
    if (optionDist < bestDist || (optionDist === bestDist && option < best)) {
      best = option;
    }
  }
  return best;
}

export function getExerciseIncrementKg(exerciseName: string): number {
  if (isMachineStackExercise(exerciseName)) {
    return Number(lbToKg(5).toFixed(2));
  }
  const isCompound = COMPOUND_EXERCISES.includes(exerciseName);
  return isCompound ? WEIGHT_INCREMENT.compound : WEIGHT_INCREMENT.isolation;
}

export function roundWeightForExercise(
  exerciseName: string,
  weightKg: number,
  strategy: "nearest" | "down" = "nearest",
): number {
  const fixedWeight = snapFixedExerciseWeight(exerciseName, weightKg, strategy);
  if (fixedWeight !== weightKg || getFixedExerciseWeights(exerciseName)) {
    return fixedWeight;
  }

  if (isMachineStackExercise(exerciseName)) {
    return snapMachineWeight(weightKg);
  }
  const increment = getExerciseIncrementKg(exerciseName);
  if (increment <= 0) {
    return weightKg;
  }
  return Math.round(weightKg / increment) * increment;
}

export function safeFloat(value: unknown, defaultValue = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }
  return defaultValue;
}

export function safeInt(value: unknown, defaultValue = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }
  return defaultValue;
}

export function serializeSets(setsData: SetLog[]): string {
  return JSON.stringify(setsData);
}

export function deserializeSets(raw: string): SetLog[] {
  if (!raw) {
    return [];
  }
  try {
    const data = JSON.parse(raw) as unknown[];
    if (!Array.isArray(data)) {
      return [];
    }
    return data.map((s) => {
      const item = s as Record<string, unknown>;
      return {
        reps: safeInt(item.reps, 0),
        rpe: safeFloat(item.rpe, TARGET_RPE),
        weight: safeFloat(item.weight, 0),
      };
    });
  } catch {
    return [];
  }
}

export function rpeToRir(rpe: number): number {
  return Math.max(0, 10 - rpe);
}

export function estimateE1rm(weight: number, reps: number, rpe: number): number {
  if (weight <= 0 || reps <= 0) {
    return 0;
  }
  const effectiveReps = reps + rpeToRir(rpe);
  return weight * (1 + effectiveReps / 30);
}

export function getSessionSets(entry: Partial<WorkoutEntry>): SetLog[] {
  const baseWeight = safeFloat(entry.weight, 0);
  const sets = entry.sets ?? [];
  return sets.map((s) => ({
    reps: safeInt(s.reps, 0),
    rpe: safeFloat(s.rpe, TARGET_RPE),
    weight: safeFloat(s.weight, baseWeight),
  }));
}

export function getSessionTopWeight(entry: Partial<WorkoutEntry>): number {
  const sets = getSessionSets(entry);
  if (!sets.length) {
    return safeFloat(entry.weight, 0);
  }
  return Math.max(...sets.map((s) => s.weight));
}

export function getSessionVolume(entry: Partial<WorkoutEntry>): number {
  return getSessionSets(entry).reduce((acc, set) => acc + set.weight * set.reps, 0);
}

export function normalizeLogs(logs: Partial<Logs>): Logs {
  const safeLogs: Logs = {
    workouts: logs.workouts ?? [],
    exercises: logs.exercises ?? {},
    skippedSessions: logs.skippedSessions ?? [],
    skippedExercises: logs.skippedExercises ?? [],
    measurements: logs.measurements ?? [],
    scheduleOffset: logs.scheduleOffset ?? 0,
  };

  Object.values(safeLogs.exercises).forEach((history) => {
    history.sort((a, b) => b.date.localeCompare(a.date));
  });

  safeLogs.skippedExercises.sort((a, b) => b.date.localeCompare(a.date));
  safeLogs.measurements.sort((a, b) => a.date.localeCompare(b.date));

  return safeLogs;
}

export function emptyLogs(): Logs {
  return {
    workouts: [],
    exercises: {},
    skippedSessions: [],
    skippedExercises: [],
    measurements: [],
    scheduleOffset: 0,
  };
}

export function calculate1rm(weight: number, reps: number, formula = "brzycki"): number {
  if (reps <= 0 || weight <= 0) {
    return 0;
  }
  if (reps === 1) {
    return weight;
  }

  let safeReps = reps;
  if (safeReps > 12) {
    safeReps = 12;
  }

  if (formula === "brzycki") {
    return weight * (36 / (37 - safeReps));
  }

  if (formula === "epley") {
    return weight * (1 + 0.0333 * safeReps);
  }

  if (formula === "lander") {
    return (100 * weight) / (101.3 - 2.67123 * safeReps);
  }

  const brzycki = weight * (36 / (37 - safeReps));
  const epley = weight * (1 + 0.0333 * safeReps);
  const lander = (100 * weight) / (101.3 - 2.67123 * safeReps);
  return (brzycki + epley + lander) / 3;
}

export function getPercentagesFrom1rm(oneRm: number): Record<string, number> {
  const percentages: Record<string, number> = {
    "100% (1RM)": 1,
    "95% (2 reps)": 0.95,
    "90% (3-4 reps)": 0.9,
    "85% (5-6 reps)": 0.85,
    "80% (7-8 reps)": 0.8,
    "75% (9-10 reps)": 0.75,
    "70% (11-12 reps)": 0.7,
    "65% (15+ reps)": 0.65,
  };
  return Object.fromEntries(Object.entries(percentages).map(([k, v]) => [k, Number((oneRm * v).toFixed(1))]));
}

export function generateWarmupSets(workingWeight: number, workingReps: number) {
  const warmup: { weight: number; reps: number; notes: string }[] = [];

  if (workingWeight >= 40) {
    warmup.push({ weight: 20, reps: 10, notes: "Empty bar / mobility" });
  }
  if (workingWeight >= 30) {
    warmup.push({
      weight: Math.round((workingWeight * 0.4) / 2.5) * 2.5,
      reps: 8,
      notes: "40% - Easy",
    });
  }

  warmup.push({ weight: Math.round((workingWeight * 0.6) / 2.5) * 2.5, reps: 5, notes: "60% - Moderate" });
  warmup.push({
    weight: Math.round((workingWeight * 0.75) / 2.5) * 2.5,
    reps: 3,
    notes: "75% - Getting heavy",
  });
  warmup.push({
    weight: Math.round((workingWeight * 0.85) / 2.5) * 2.5,
    reps: 2,
    notes: "85% - Prime nervous system",
  });

  if (workingReps <= 6) {
    warmup.push({
      weight: Math.round((workingWeight * 0.9) / 2.5) * 2.5,
      reps: 1,
      notes: "90% - Final prep",
    });
  }

  return warmup;
}

function toDateOrNull(dateStr: string): Date | null {
  if (!dateStr) {
    return null;
  }
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function weekKeyFromDate(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay();
  const mondayOffset = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - mondayOffset);
  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.floor((d.getTime() - yearStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${year}-W${String(Math.max(week, 0)).padStart(2, "0")}`;
}

export function parseLogDate(dateStr: string): Date | null {
  if (!dateStr) {
    return null;
  }

  const value = dateStr.trim();

  // Parse ISO-like local strings manually to preserve the recorded calendar day
  // regardless of timezone suffix (e.g., Z or +01:00).
  // Supported:
  // - YYYY-MM-DD
  // - YYYY-MM-DDTHH:mm[:ss[.sss]]
  // - YYYY-MM-DD HH:mm[:ss[.sss]]
  const isoLike = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2})(?::(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?)?/,
  );
  if (isoLike) {
    const year = Number.parseInt(isoLike[1], 10);
    const month = Number.parseInt(isoLike[2], 10);
    const day = Number.parseInt(isoLike[3], 10);
    const hour = Number.parseInt(isoLike[4] ?? "0", 10);
    const minute = Number.parseInt(isoLike[5] ?? "0", 10);
    const second = Number.parseInt(isoLike[6] ?? "0", 10);
    const msRaw = isoLike[7] ?? "0";
    const millisecond = Number.parseInt(msRaw.padEnd(3, "0").slice(0, 3), 10);
    const localDate = new Date(year, month - 1, day, hour, minute, second, millisecond);
    if (Number.isNaN(localDate.getTime())) {
      return null;
    }
    return localDate;
  }

  const slashDate = value.match(
    /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[T\s](\d{1,2})(?::(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?)?/,
  );
  if (slashDate) {
    const first = Number.parseInt(slashDate[1], 10);
    const second = Number.parseInt(slashDate[2], 10);
    const year = Number.parseInt(slashDate[3], 10);
    const hour = Number.parseInt(slashDate[4] ?? "0", 10);
    const minute = Number.parseInt(slashDate[5] ?? "0", 10);
    const secondPart = Number.parseInt(slashDate[6] ?? "0", 10);
    const msRaw = slashDate[7] ?? "0";
    const millisecond = Number.parseInt(msRaw.padEnd(3, "0").slice(0, 3), 10);

    let day = first;
    let month = second;
    if (first <= 12 && second > 12) {
      month = first;
      day = second;
    } else if (first > 12 && second <= 12) {
      day = first;
      month = second;
    }

    const localDate = new Date(year, month - 1, day, hour, minute, secondPart, millisecond);
    if (Number.isNaN(localDate.getTime())) {
      return null;
    }
    return localDate;
  }

  const numeric = Number.parseFloat(value);
  if (Number.isFinite(numeric) && /^[-+]?\d+(\.\d+)?$/.test(value)) {
    if (value.length >= 13) {
      const epochMs = new Date(numeric);
      if (!Number.isNaN(epochMs.getTime())) {
        return epochMs;
      }
    }
    if (value.length === 10) {
      const epochSec = new Date(numeric * 1000);
      if (!Number.isNaN(epochSec.getTime())) {
        return epochSec;
      }
    }
    if (numeric > 20000 && numeric < 80000) {
      const excelEpoch = new Date(1899, 11, 30);
      const excelDate = new Date(excelEpoch.getTime() + numeric * 24 * 60 * 60 * 1000);
      if (!Number.isNaN(excelDate.getTime())) {
        return excelDate;
      }
    }
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

export function calculateStreak(logs: Logs): StreakStats {
  const workouts = logs.workouts;
  if (!workouts.length) {
    return {
      currentStreakWeeks: 0,
      longestStreakWeeks: 0,
      totalWeeksTrained: 0,
      consistencyPercent: 0,
      workoutsThisWeek: 0,
      targetWorkoutsWeek: TARGET_WORKOUTS_WEEK,
    };
  }

  const workoutDates = new Set<string>();
  for (const w of workouts) {
    const day = w.date.slice(0, 10);
    if (day) {
      workoutDates.add(day);
    }
  }

  if (!workoutDates.size) {
    return {
      currentStreakWeeks: 0,
      longestStreakWeeks: 0,
      totalWeeksTrained: 0,
      consistencyPercent: 0,
      workoutsThisWeek: 0,
      targetWorkoutsWeek: TARGET_WORKOUTS_WEEK,
    };
  }

  const dates = Array.from(workoutDates)
    .map((d) => toDateOrNull(d))
    .filter((d): d is Date => d instanceof Date)
    .sort((a, b) => a.getTime() - b.getTime());

  if (!dates.length) {
    return {
      currentStreakWeeks: 0,
      longestStreakWeeks: 0,
      totalWeeksTrained: 0,
      consistencyPercent: 0,
      workoutsThisWeek: 0,
      targetWorkoutsWeek: TARGET_WORKOUTS_WEEK,
    };
  }

  const weeksTrained = new Set<string>(dates.map((d) => weekKeyFromDate(d)));

  const now = new Date();
  const currentWeek = weekKeyFromDate(now);
  const workoutsThisWeek = dates.filter((d) => weekKeyFromDate(d) === currentWeek).length;

  const allWeeks: string[] = [];
  const cursor = new Date(dates[0]);
  while (cursor <= now) {
    allWeeks.push(weekKeyFromDate(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }

  let currentStreak = 0;
  for (let i = allWeeks.length - 1; i >= 0; i -= 1) {
    if (weeksTrained.has(allWeeks[i])) {
      currentStreak += 1;
    } else {
      break;
    }
  }

  let longestStreak = 0;
  let tempStreak = 0;
  for (const week of allWeeks) {
    if (weeksTrained.has(week)) {
      tempStreak += 1;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }

  const totalPossibleWeeks = allWeeks.length;
  const consistencyPercent = totalPossibleWeeks ? (weeksTrained.size / totalPossibleWeeks) * 100 : 0;

  return {
    currentStreakWeeks: currentStreak,
    longestStreakWeeks: longestStreak,
    totalWeeksTrained: weeksTrained.size,
    consistencyPercent: Number(consistencyPercent.toFixed(1)),
    workoutsThisWeek,
    targetWorkoutsWeek: TARGET_WORKOUTS_WEEK,
  };
}

function emptyWeeklyBucket() {
  return {
    sessions: 0,
    sets: 0,
    volume: 0,
    rpeSum: 0,
    rpeCount: 0,
    e1rmSum: 0,
    avgRpe: 0,
    avgE1rm: 0,
  };
}

export function getWeeklyReview(logs: Logs, days = 7): WeeklyReview {
  const now = new Date();
  const recentCutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const previousCutoff = new Date(now.getTime() - days * 2 * 24 * 60 * 60 * 1000);

  const review: WeeklyReview = {
    recent: emptyWeeklyBucket(),
    previous: emptyWeeklyBucket(),
  };

  for (const history of Object.values(logs.exercises)) {
    for (const entry of history) {
      const entryDate = parseLogDate(entry.date);
      if (!entryDate) {
        continue;
      }

      const bucket =
        entryDate >= recentCutoff ? review.recent : entryDate >= previousCutoff ? review.previous : undefined;

      if (!bucket) {
        continue;
      }

      const sets = getSessionSets(entry);
      if (!sets.length) {
        continue;
      }

      bucket.sessions += 1;
      bucket.sets += sets.length;
      bucket.volume += sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
      bucket.rpeSum += sets.reduce((sum, s) => sum + s.rpe, 0);
      bucket.rpeCount += sets.length;

      const bestSet = [...sets].sort((a, b) => estimateE1rm(b.weight, b.reps, b.rpe) - estimateE1rm(a.weight, a.reps, a.rpe))[0];
      bucket.e1rmSum += estimateE1rm(bestSet.weight, bestSet.reps, bestSet.rpe);
    }
  }

  review.recent.avgRpe = review.recent.rpeCount ? Number((review.recent.rpeSum / review.recent.rpeCount).toFixed(2)) : 0;
  review.previous.avgRpe = review.previous.rpeCount
    ? Number((review.previous.rpeSum / review.previous.rpeCount).toFixed(2))
    : 0;
  review.recent.avgE1rm = review.recent.sessions ? Number((review.recent.e1rmSum / review.recent.sessions).toFixed(1)) : 0;
  review.previous.avgE1rm = review.previous.sessions
    ? Number((review.previous.e1rmSum / review.previous.sessions).toFixed(1))
    : 0;

  return review;
}

export function checkForNewPr(exerciseName: string, weight: number, logs: Logs): [boolean, number] {
  const history = logs.exercises[exerciseName] ?? [];
  if (!history.length) {
    return [true, 0];
  }
  const maxWeight = Math.max(...history.map((h) => getSessionTopWeight(h)));
  if (weight > maxWeight) {
    return [true, maxWeight];
  }
  return [false, maxWeight];
}

export function getAdjustedSchedule(settings: Settings) {
  const offset = settings.scheduleOffset;
  if (offset === 0) {
    return { ...BASE_SCHEDULE };
  }

  const adjusted = {} as Record<number, WorkoutName | "Rest">;
  for (let day = 0; day < 7; day += 1) {
    const originalDay = (day - offset) % 7;
    adjusted[day] = BASE_SCHEDULE[(originalDay + 7) % 7];
  }
  return adjusted;
}

export function getTodayWorkoutWithSettings(settings: Settings): ["Holiday" | "Rest" | WorkoutName, ExerciseConfig[]] {
  if (settings.holidayMode) {
    return ["Holiday", []];
  }
  const schedule = getAdjustedSchedule(settings);
  const dayOfWeek = (new Date().getDay() + 6) % 7;
  const workout = schedule[dayOfWeek];
  if (workout === "Rest") {
    return ["Rest", []];
  }
  return [workout, EXERCISES[workout] ?? []];
}

export function getNextTrainingDay(settings: Settings): [string, string, number] {
  if (settings.holidayMode) {
    return ["Holiday", "N/A", 0];
  }
  const schedule = getAdjustedSchedule(settings);
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const currentDay = (new Date().getDay() + 6) % 7;

  for (let i = 1; i <= 7; i += 1) {
    const checkDay = (currentDay + i) % 7;
    if (schedule[checkDay] !== "Rest") {
      return [schedule[checkDay], dayNames[checkDay], i];
    }
  }
  return ["Rest", "N/A", 7];
}

export function getWeekSchedulePreview(settings: Settings) {
  const schedule = getAdjustedSchedule(settings);
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const today = (new Date().getDay() + 6) % 7;

  return Array.from({ length: 7 }).map((_, i) => {
    const day = (today + i) % 7;
    return {
      day: dayNames[day],
      workout: settings.holidayMode ? "❄️" : schedule[day],
      isToday: i === 0,
    };
  });
}

export function getBrainStatus(): [string, string, string] {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 9) {
    return ["🌅", "Morning Prep", "Fuel up and hydrate."];
  }
  if (hour >= 9 && hour < 12) {
    return ["🧠", "Deep Work AM", "Peak cognitive hours."];
  }
  if (hour >= 12 && hour < 14) {
    return ["🍽️", "Lunch & Digest", "Eat, walk 15 min after."];
  }
  if (hour >= 14 && hour < 17) {
    return ["🧠", "Deep Work PM", "Second study block."];
  }
  if (hour >= 17 && hour < 20) {
    return ["💪", "GYM MODE", "Time to grow those legs!"];
  }
  if (hour >= 20 && hour < 22) {
    return ["🍽️", "Dinner & Wind Down", "Eat, relax."];
  }
  if (hour >= 22 && hour < 24) {
    return ["🌙", "Recovery Mode", "Sleep is gains."];
  }
  return ["😴", "Sleep Time", "Recovery is key."];
}

export function formatRecommendationBadge(recommendation: string): string {
  const colors: Record<string, string> = {
    PROGRESS: "🟢",
    PUSH: "🔵",
    BUILD: "🟡",
    CONSOLIDATE: "🟠",
    DELOAD: "🔴",
    BASELINE: "⚪",
    NORMAL: "🟢",
    VOLUME: "🟡",
    LIGHT_RETURN: "🔵",
    REACCLIMATION: "🟡",
    REBUILDING: "🟠",
    FRESH_START: "🔴",
  };
  return `${colors[recommendation] ?? "⚪"} ${recommendation.replaceAll("_", " ")}`;
}

export function formatTrendBadge(trend: string): string {
  const indicators: Record<string, string> = {
    IMPROVING: "📈",
    STABLE: "➡️",
    DECLINING: "📉",
    VARIABLE: "〰️",
    NO_DATA: "❓",
  };
  return indicators[trend] ?? "❓";
}

export class AdaptiveCoach {
  private logs: Logs;
  private exerciseHistory: Record<string, WorkoutEntry[]>;
  private settings: Settings;
  private programmingState: ProgrammingState;

  constructor(logs: Logs, settings?: Settings) {
    this.logs = logs;
    this.exerciseHistory = logs.exercises;
    this.settings = settings ?? {
      mealPlan: "Option 1 - Clean/Rice",
      holidayMode: false,
      holidayStart: null,
      scheduleOffset: 0,
      progressionState: {
        waveAnchorDate: null,
        earlyPivotActive: false,
      },
    };
    const fatigue = computeFatigueState(logs);
    const muscleDose = computeWeeklyMuscleDose(logs);
    const muscleAdjustments = computeMuscleAdjustments(muscleDose);
    const wave = resolveWaveState(logs, this.settings, fatigue);
    const bodyweightStatus = resolveBodyweightForDate(new Date().toISOString(), logs.measurements);
    this.programmingState = {
      wave,
      fatigue,
      muscleDose,
      muscleAdjustments,
      bodyweightStatus,
    };
  }

  getProgrammingState() {
    return this.programmingState;
  }

  calculateSetScore(reps: number, rpe: number, minRange: number, maxRange: number): number {
    let repScore = 0;
    if (reps < minRange) {
      repScore = Math.max(0, (reps / minRange) * 30);
    } else if (reps > maxRange) {
      repScore = 100;
    } else {
      const rangePosition = (reps - minRange) / (maxRange - minRange);
      repScore = 30 + rangePosition * 70;
    }

    let rpeModifier = 1 + (9 - rpe) * 0.05;
    rpeModifier = Math.max(0.85, Math.min(1.2, rpeModifier));
    return Math.min(100, repScore * rpeModifier);
  }

  calculateSessionScore(setsData: SetLog[], minRange: number, maxRange: number): [number, string] {
    if (!setsData.length) {
      return [0, "No data"];
    }

    const scores: number[] = [];
    const repsList: number[] = [];

    for (const setData of setsData) {
      repsList.push(setData.reps);
      scores.push(this.calculateSetScore(setData.reps, setData.rpe, minRange, maxRange));
    }

    let avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const repVariance = Math.max(...repsList) - Math.min(...repsList);

    let consistency = "Good consistency";
    if (repVariance <= 1) {
      consistency = "Excellent consistency";
      avgScore *= 1.05;
    } else if (repVariance > 2) {
      consistency = "Work on set-to-set consistency";
      avgScore *= 0.95;
    }

    return [Math.min(100, avgScore), consistency];
  }

  private getPullUpSystemLoad(entry: WorkoutEntry): number {
    const externalLoad = getSessionTopWeight(entry);
    const bw = resolveBodyweightForDate(entry.date, this.logs.measurements).bodyWeight;
    return externalLoad + bw;
  }

  private countConsecutiveQualitySessions(exerciseName: string, repRange: [number, number], required = 2): number {
    const maxRange = repRange[1];
    const history = this.getExerciseHistory(exerciseName, required + 1);
    if (!history.length) {
      return 0;
    }

    let count = 0;
    for (const session of history) {
      const stats = this.getSessionStats(session, repRange);
      const repsOk = stats.avgReps >= maxRange - 0.25;
      const rpeOk = stats.topSetRpe <= MAX_RPE && (stats.backoffSets === 0 || stats.backoffAvgRpe <= MAX_RPE);
      const dropoffOk = stats.repDropoff <= 3;
      const qualityOk = repsOk && rpeOk && dropoffOk;
      if (!qualityOk) {
        break;
      }
      count += 1;
      if (count >= required) {
        return count;
      }
    }
    return count;
  }

  private pullUpGatePassed(repRange: [number, number], required = 2): [boolean, number] {
    const maxRange = repRange[1];
    const history = this.getExerciseHistory("Pull-Up (Weighted)", required + 1);
    if (!history.length) {
      return [false, 0];
    }

    let count = 0;
    let previousSystemLoad = Number.POSITIVE_INFINITY;
    for (const session of history) {
      const stats = this.getSessionStats(session, repRange);
      const systemLoad = this.getPullUpSystemLoad(session);
      const repsOk = stats.avgReps >= maxRange - 0.25;
      const rpeOk = stats.topSetRpe <= MAX_RPE && (stats.backoffSets === 0 || stats.backoffAvgRpe <= MAX_RPE);
      const loadOk = systemLoad <= previousSystemLoad + 5 || count === 0;
      const qualityOk = repsOk && rpeOk && loadOk;
      if (!qualityOk) {
        break;
      }
      count += 1;
      previousSystemLoad = systemLoad;
      if (count >= required) {
        return [true, count];
      }
    }
    return [false, count];
  }

  private getPrescribedSets(exerciseName: string, defaultSets: number): { sets: number; reasons: string[] } {
    const meta = getExerciseMeta(exerciseName);
    const muscleAdj = this.programmingState.muscleAdjustments[meta.primaryGroup];
    const wave = this.programmingState.wave;
    const fatigue = this.programmingState.fatigue;
    const skippedCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const skippedPrimaryCount = this.logs.skippedExercises.filter((entry) => {
      const date = parseLogDate(entry.date);
      if (!date || date.getTime() < skippedCutoff) {
        return false;
      }
      return getExerciseMeta(entry.exercise).primaryGroup === meta.primaryGroup;
    }).length;

    const minSets = meta.minSets ?? Math.max(1, defaultSets - 1);
    const maxSets = meta.maxSets ?? defaultSets + 1;
    let sets = defaultSets;
    const reasons: string[] = [];

    let intendedAction: MuscleAdjustmentAction = muscleAdj?.action ?? "hold";

    if (wave.week === 3 && intendedAction === "increase") {
      intendedAction = "hold";
      reasons.push("Wave week 3 keeps set count stable while intensity is prioritized.");
    }
    if (fatigue.zone === "YELLOW" && intendedAction === "increase") {
      intendedAction = "hold";
      reasons.push("Fatigue yellow: deferred set increase this week.");
    }
    if (fatigue.zone === "RED") {
      intendedAction = "decrease";
      reasons.push("Fatigue red: reducing sets to improve recovery.");
    }

    if (intendedAction === "increase") {
      sets += 1;
      reasons.push(
        `${meta.primaryGroup} dose is below target (${muscleAdj.currentDose}/${muscleAdj.targetMin}-${muscleAdj.targetMax}).`,
      );
      if (skippedPrimaryCount > 0) {
        reasons.push(
          `${skippedPrimaryCount} ${meta.primaryGroup} exercise skip(s) were logged intentionally this week.`,
        );
      }
    } else if (intendedAction === "decrease") {
      sets -= 1;
      reasons.push(
        `${meta.primaryGroup} dose is above target (${muscleAdj.currentDose}/${muscleAdj.targetMin}-${muscleAdj.targetMax}).`,
      );
    }

    if (wave.isPivotWeek) {
      const pivotSets = Math.max(minSets, Math.round(sets * 0.7));
      if (pivotSets < sets) {
        reasons.push("Wave week 4 pivot: volume reduced by ~30%.");
      }
      sets = pivotSets;
    }

    sets = Math.max(minSets, Math.min(maxSets, sets));
    return { sets, reasons };
  }

  getSessionStats(session: WorkoutEntry, repRange: [number, number]): SessionStats {
    const sets = getSessionSets(session);
    if (!sets.length) {
      return {
        sets: [],
        topWeight: safeFloat(session.weight, 0),
        topSetReps: 0,
        topSetRpe: TARGET_RPE,
        backoffSets: 0,
        backoffAvgReps: 0,
        backoffMinReps: 0,
        backoffAvgRpe: TARGET_RPE,
        backoffRepDropoff: 0,
        avgReps: 0,
        minReps: 0,
        maxReps: 0,
        avgRpe: TARGET_RPE,
        repDropoff: 0,
        volume: 0,
        bestE1rm: 0,
        allSetsInRange: false,
      };
    }

    const [minRange, maxRange] = repRange;
    const weights = sets.map((s) => s.weight);
    const reps = sets.map((s) => s.reps);
    const rpes = sets.map((s) => s.rpe);

    const topWeight = Math.max(...weights);
    const topSets = sets.filter((s) => s.weight >= topWeight * 0.99);
    // Top set is defined as the first heaviest set logged in session order.
    const topSet = topSets[0] ?? sets[0];

    const backoffSets = sets.filter((s) => s.weight < topWeight * 0.99);

    let backoffAvgReps = 0;
    let backoffMinReps = 0;
    let backoffAvgRpe = TARGET_RPE;
    let backoffRepDropoff = 0;

    if (backoffSets.length) {
      const backoffReps = backoffSets.map((s) => s.reps);
      const backoffRpes = backoffSets.map((s) => s.rpe);
      backoffAvgReps = backoffReps.reduce((sum, r) => sum + r, 0) / backoffReps.length;
      backoffMinReps = Math.min(...backoffReps);
      backoffAvgRpe = backoffRpes.reduce((sum, r) => sum + r, 0) / backoffRpes.length;
      backoffRepDropoff = Math.max(...backoffReps) - Math.min(...backoffReps);
    }

    const volume = sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
    const e1rms = sets.map((s) => estimateE1rm(s.weight, s.reps, s.rpe));
    const inRangeSets = reps.filter((r) => r >= minRange && r <= maxRange).length;

    return {
      sets,
      topWeight,
      topSetReps: topSet.reps,
      topSetRpe: topSet.rpe,
      backoffSets: backoffSets.length,
      backoffAvgReps,
      backoffMinReps,
      backoffAvgRpe,
      backoffRepDropoff,
      avgReps: reps.reduce((sum, r) => sum + r, 0) / reps.length,
      minReps: Math.min(...reps),
      maxReps: Math.max(...reps),
      avgRpe: rpes.reduce((sum, r) => sum + r, 0) / rpes.length,
      repDropoff: Math.max(...reps) - Math.min(...reps),
      volume,
      bestE1rm: e1rms.length ? Math.max(...e1rms) : 0,
      allSetsInRange: inRangeSets === reps.length,
    };
  }

  getBackoffAdjustment(sessionStats: SessionStats, repRange: [number, number]): [number, string | null] {
    if (sessionStats.backoffSets === 0) {
      return [BACKOFF_PERCENT, null];
    }

    const [minRange, maxRange] = repRange;
    const topSuccess = sessionStats.topSetReps >= minRange && sessionStats.topSetRpe <= MAX_RPE;

    if (
      topSuccess &&
      (sessionStats.backoffMinReps < minRange ||
        sessionStats.backoffAvgRpe > MAX_RPE ||
        sessionStats.backoffRepDropoff >= 3)
    ) {
      const newPercent = Math.max(BACKOFF_MIN_PERCENT, BACKOFF_PERCENT - 0.05);
      return [newPercent, `Back-off auto-adjusted to ${Math.round(newPercent * 100)}% for quality reps.`];
    }

    if (sessionStats.backoffAvgReps < minRange) {
      const newPercent = Math.max(BACKOFF_MIN_PERCENT, BACKOFF_PERCENT - 0.03);
      return [newPercent, `Back-off reduced to ${Math.round(newPercent * 100)}% to stay in range.`];
    }

    if (sessionStats.backoffAvgReps >= maxRange && sessionStats.backoffAvgRpe <= TARGET_RPE - 0.5) {
      const newPercent = Math.min(BACKOFF_MAX_PERCENT, BACKOFF_PERCENT + 0.02);
      return [newPercent, `Back-off nudged up to ${Math.round(newPercent * 100)}% for more overload.`];
    }

    return [BACKOFF_PERCENT, null];
  }

  getExerciseHistory(exerciseName: string, limit = 10): WorkoutEntry[] {
    return [...(this.exerciseHistory[exerciseName] ?? [])]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  }

  getDaysSinceLastSession(exerciseName: string): number | null {
    const history = this.getExerciseHistory(exerciseName, 1);
    if (!history.length) {
      return null;
    }

    const lastDate = parseLogDate(history[0].date);
    if (!lastDate) {
      return null;
    }

    const diffMs = new Date().getTime() - lastDate.getTime();
    return Math.floor(diffMs / (24 * 60 * 60 * 1000));
  }

  getReturnDeloadFactor(daysGap: number): [number, string, string] {
    if (daysGap <= 14) {
      return [1, "NORMAL", ""];
    }
    if (daysGap <= 28) {
      return [0.9, "LIGHT_RETURN", "Light return week - ease back in"];
    }
    if (daysGap <= 56) {
      return [0.8, "REACCLIMATION", "Re-acclimation phase - rebuild the groove"];
    }
    if (daysGap <= 90) {
      return [0.7, "REBUILDING", "Rebuilding phase - muscle memory will help!"];
    }
    return [0.6, "FRESH_START", "Fresh start - your muscles remember more than you think!"];
  }

  analyzeMultiSessionTrend(exerciseName: string, repRange: [number, number], numSessions = 3): TrendInfo {
    const history = this.getExerciseHistory(exerciseName, numSessions + 2);

    if (history.length < 1) {
      return {
        hasData: false,
        trend: "NO_DATA",
        avgE1rm: null,
        avgReps: null,
        avgRpe: null,
        e1rmTrend: 0,
        repTrend: 0,
        rpeTrend: 0,
        sessionsAnalyzed: 0,
      };
    }

    const sessionStats = history.slice(0, numSessions).map((h) => this.getSessionStats(h, repRange));
    const e1rms = sessionStats.map((s) => s.bestE1rm);
    const avgReps = sessionStats.reduce((sum, s) => sum + s.avgReps, 0) / sessionStats.length;
    const avgRpe = sessionStats.reduce((sum, s) => sum + s.topSetRpe, 0) / sessionStats.length;

    let e1rmTrend = 0;
    let repTrend = 0;
    let rpeTrend = 0;

    if (sessionStats.length >= 2) {
      const recent = sessionStats[0];
      const older = sessionStats.slice(1, numSessions);
      const prevAvgE1rm = older.reduce((sum, s) => sum + s.bestE1rm, 0) / older.length;
      const prevAvgReps = older.reduce((sum, s) => sum + s.avgReps, 0) / older.length;
      const prevAvgRpe = older.reduce((sum, s) => sum + s.topSetRpe, 0) / older.length;

      e1rmTrend = recent.bestE1rm - prevAvgE1rm;
      repTrend = recent.avgReps - prevAvgReps;
      rpeTrend = recent.topSetRpe - prevAvgRpe;
    }

    const prevAvg = e1rms.length > 1 ? e1rms.slice(1).reduce((sum, v) => sum + v, 0) / (e1rms.length - 1) : e1rms[0];
    const threshold = prevAvg ? Math.max(0.5, prevAvg * 0.01) : 0.5;

    let trend: TrendInfo["trend"] = "VARIABLE";
    if (e1rmTrend > threshold || (repTrend > 0.5 && rpeTrend <= 0.3)) {
      trend = "IMPROVING";
    } else if (e1rmTrend < -threshold || (repTrend < -0.5 && rpeTrend > 0.5)) {
      trend = "DECLINING";
    } else if (Math.abs(e1rmTrend) <= threshold && Math.abs(repTrend) <= 0.5) {
      trend = "STABLE";
    }

    return {
      hasData: true,
      trend,
      avgE1rm: Number((e1rms.reduce((sum, v) => sum + v, 0) / e1rms.length).toFixed(1)),
      avgReps: Number(avgReps.toFixed(1)),
      avgRpe: Number(avgRpe.toFixed(1)),
      e1rmTrend: Number(e1rmTrend.toFixed(1)),
      repTrend: Number(repTrend.toFixed(1)),
      rpeTrend: Number(rpeTrend.toFixed(1)),
      sessionsAnalyzed: Math.min(history.length, numSessions),
    };
  }

  detectPlateau(exerciseName: string, repRange: [number, number]): [boolean, number, string] {
    const history = this.getExerciseHistory(exerciseName, 6);
    if (history.length < 3) {
      return [false, 0, "Keep training - building baseline data"];
    }

    let stallCount = 0;

    for (let i = 0; i < history.length - 1; i += 1) {
      const current = this.getSessionStats(history[i], repRange);
      const previous = this.getSessionStats(history[i + 1], repRange);

      if (current.bestE1rm <= previous.bestE1rm + 0.5 && current.avgReps <= previous.avgReps + 0.25) {
        stallCount += 1;
      } else {
        break;
      }
    }

    const trend = this.analyzeMultiSessionTrend(exerciseName, repRange, 3);
    if (trend.hasData && trend.rpeTrend > 0.5 && trend.trend !== "IMPROVING") {
      if (stallCount >= 2) {
        return [true, stallCount, "RPE increasing without progress - fatigue accumulating."];
      }
    }

    if (stallCount >= 4) {
      return [true, stallCount, "Significant plateau! Time for a strategic deload."];
    }

    if (stallCount >= 2) {
      return [true, stallCount, "Minor stall detected. Consider a volume boost."];
    }

    return [false, stallCount, "Progressing well!"];
  }

  getNextTarget(exerciseName: string, exerciseConfig: ExerciseConfig): NextTarget {
    const history = this.getExerciseHistory(exerciseName, 8);
    const [minRange, maxRange] = exerciseConfig.repRange;
    const meta = getExerciseMeta(exerciseName);
    const useMachineStack = isMachineStackExercise(exerciseName);
    const isInclineDumbbellCurl = exerciseName === "Incline Dumbbell Curl";
    const isPullUp = exerciseName === "Pull-Up (Weighted)";
    const isCompoundExercise = COMPOUND_EXERCISES.includes(exerciseName);
    const increment = getExerciseIncrementKg(exerciseName);
    const setPrescription = this.getPrescribedSets(exerciseName, exerciseConfig.sets);
    const baseAdjustmentReasons = [...setPrescription.reasons];
    if (meta.unilateral) {
      baseAdjustmentReasons.push("Unilateral exercise: log and progress from the weakest-side set each round.");
    }

    const currentBodyweight = resolveBodyweightForDate(new Date().toISOString(), this.logs.measurements);
    if (isPullUp && currentBodyweight.staleDays !== null && currentBodyweight.staleDays > 21) {
      baseAdjustmentReasons.push(
        `Bodyweight check: latest measurement is ${currentBodyweight.staleDays} days old (update for tighter pull-up progression).`,
      );
    }

    const roundToIncrement = (value: number, strategy: "nearest" | "down" = "nearest") => {
      if (useMachineStack) {
        return roundWeightForExercise(exerciseName, value);
      }
      if (isInclineDumbbellCurl) {
        return roundWeightForExercise(exerciseName, value, strategy);
      }
      if (increment <= 0) {
        return value;
      }
      return Math.round(value / increment) * increment;
    };

    const normalizeWeight = (value: number, roundWeight: boolean) => {
      if (useMachineStack) {
        return roundToIncrement(value);
      }
      if (!roundWeight) {
        return value;
      }
      return roundToIncrement(value);
    };

    const buildTarget = (
      weight: number,
      reps: number,
      recommendation: NextTarget["recommendation"],
      message: string,
      options?: {
        backoffPercent?: number;
        backoffReps?: number;
        roundWeight?: boolean;
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
        adjustmentReasons?: string[];
        bodyweightUsed?: number;
        bodyweightStaleDays?: number | null;
      },
    ): NextTarget => {
      const rawBackoffPercent = options?.backoffPercent ?? (isInclineDumbbellCurl ? 0.83 : BACKOFF_PERCENT);
      const backoffPercent = isInclineDumbbellCurl
        ? Math.max(0.8, Math.min(0.86, rawBackoffPercent))
        : rawBackoffPercent;
      const roundWeight = options?.roundWeight ?? true;
      const baseWeight = normalizeWeight(weight, roundWeight);
      const backoffWeight = roundToIncrement(baseWeight * backoffPercent, isInclineDumbbellCurl ? "down" : "nearest");
      const defaultBackoffReps = isInclineDumbbellCurl
        ? Math.max(1, Math.min(maxRange, Math.max(minRange - 1, reps - 1)))
        : Math.min(maxRange, Math.max(reps, minRange) + 2);
      const backoffReps = Math.max(1, Math.round(options?.backoffReps ?? defaultBackoffReps));
      const adjustmentReasons = Array.from(
        new Set([...(baseAdjustmentReasons ?? []), ...(options?.adjustmentReasons ?? [])]),
      );

      return {
        weight: baseWeight,
        repsPerSet: reps,
        prescribedSets: setPrescription.sets,
        recommendation,
        message,
        backoffWeight,
        backoffReps,
        backoffPercent,
        waveWeek: this.programmingState.wave.week,
        fatigueZone: this.programmingState.fatigue.zone,
        adjustmentReasons,
        bodyweightUsed: options?.bodyweightUsed,
        bodyweightStaleDays: options?.bodyweightStaleDays,
        confidence: options?.confidence,
        isNew: options?.isNew,
        trendInfo: options?.trendInfo,
        backoffNote: options?.backoffNote,
        previous: options?.previous,
        suggestedExtraSets: options?.suggestedExtraSets,
        plateauInfo: options?.plateauInfo,
        daysSinceLast: options?.daysSinceLast,
        lastWeight: options?.lastWeight,
        lastReps: options?.lastReps,
        lastRpe: options?.lastRpe,
        deloadPercent: options?.deloadPercent,
      };
    };

    if (!history.length) {
      const startingWeight = STARTING_WEIGHTS[exerciseName] ?? 20;
      const displayStart = useMachineStack ? roundToIncrement(startingWeight) : startingWeight;
      return buildTarget(startingWeight, minRange, "BASELINE", `First time! Start with ${displayStart}kg for ${minRange} reps.`, {
        confidence: 50,
        isNew: true,
        trendInfo: null,
        adjustmentReasons: this.programmingState.wave.notes,
        bodyweightUsed: isPullUp ? currentBodyweight.bodyWeight : undefined,
        bodyweightStaleDays: isPullUp ? currentBodyweight.staleDays : undefined,
      });
    }

    const daysGap = this.getDaysSinceLastSession(exerciseName);
    const lastSession = history[0];
    const lastStats = this.getSessionStats(lastSession, [minRange, maxRange]);
    const lastWeight = lastStats.topWeight;
    const lastReps = lastStats.sets.map((s) => s.reps);
    const lastAvgRpe = lastStats.avgRpe;
    const displayLastWeight = useMachineStack ? roundToIncrement(lastWeight) : lastWeight;

    if (daysGap !== null && daysGap > 14) {
      const [deloadFactor, phase, phaseMsg] = this.getReturnDeloadFactor(daysGap);
      const returnWeight = roundToIncrement(lastWeight * deloadFactor);
      const deloadPercent = Math.round((1 - deloadFactor) * 100);

      return buildTarget(returnWeight, minRange, phase as NextTarget["recommendation"], phaseMsg, {
        confidence: 85,
        isNew: false,
        trendInfo: null,
        daysSinceLast: daysGap,
        lastWeight,
        lastReps,
        lastRpe: Number(lastAvgRpe.toFixed(1)),
        deloadPercent,
        previous: `Last (${daysGap} days ago): ${lastWeight}kg × ${JSON.stringify(lastReps)}`,
        adjustmentReasons: ["Return-from-break ramp: restart with controlled loading."],
        bodyweightUsed: isPullUp ? currentBodyweight.bodyWeight : undefined,
        bodyweightStaleDays: isPullUp ? currentBodyweight.staleDays : undefined,
      });
    }

    const [rawBackoffPercent, rawBackoffNote] = this.getBackoffAdjustment(lastStats, [minRange, maxRange]);
    const backoffPercent = isInclineDumbbellCurl
      ? Math.max(0.8, Math.min(0.86, rawBackoffPercent - 0.01))
      : rawBackoffPercent;
    const backoffNote = isInclineDumbbellCurl
      ? [rawBackoffNote, "Incline curl fatigue profile: lighter back-off load with lower rep target."]
          .filter(Boolean)
          .join(" ")
      : rawBackoffNote;
    const trend = this.analyzeMultiSessionTrend(exerciseName, [minRange, maxRange], 3);

    if (this.programmingState.wave.isPivotWeek) {
      const pivotLoadFactor = isCompoundExercise ? 0.95 : 0.975;
      const pivotWeight = roundToIncrement(lastWeight * pivotLoadFactor);
      return buildTarget(
        pivotWeight,
        minRange,
        "CONSOLIDATE",
        `Pivot week: reduce load and keep clean quality reps before the next build cycle.`,
        {
          backoffPercent: Math.max(BACKOFF_MIN_PERCENT, backoffPercent - 0.03),
          confidence: 88,
          isNew: false,
          trendInfo: trend,
          backoffNote,
          adjustmentReasons: [...this.programmingState.wave.notes],
          bodyweightUsed: isPullUp ? currentBodyweight.bodyWeight : undefined,
          bodyweightStaleDays: isPullUp ? currentBodyweight.staleDays : undefined,
        },
      );
    }

    if (this.programmingState.fatigue.zone === "RED") {
      const fatigueWeight = roundToIncrement(lastWeight * 0.95);
      return buildTarget(
        fatigueWeight,
        minRange,
        "DELOAD",
        "Global fatigue is high. Pulling load down for one session to restore quality.",
        {
          backoffPercent: Math.max(BACKOFF_MIN_PERCENT, backoffPercent - 0.03),
          confidence: 90,
          isNew: false,
          trendInfo: trend,
          backoffNote,
          adjustmentReasons: this.programmingState.fatigue.reasons,
          deloadPercent: 5,
          bodyweightUsed: isPullUp ? currentBodyweight.bodyWeight : undefined,
          bodyweightStaleDays: isPullUp ? currentBodyweight.staleDays : undefined,
        },
      );
    }

    if (history.length === 1) {
      return buildTarget(lastWeight, minRange + 1, "BUILD", `Second session! Use ${displayLastWeight}kg again, aim for ${minRange + 1} reps.`, {
        backoffPercent,
        roundWeight: false,
        confidence: 60,
        isNew: false,
        trendInfo: trend,
        backoffNote,
        previous: `Last: ${lastWeight}kg × ${JSON.stringify(lastReps)}`,
        adjustmentReasons: this.programmingState.wave.notes,
        bodyweightUsed: isPullUp ? currentBodyweight.bodyWeight : undefined,
        bodyweightStaleDays: isPullUp ? currentBodyweight.staleDays : undefined,
      });
    }

    const [isPlateaued, stallCount, plateauMsg] = this.detectPlateau(exerciseName, [minRange, maxRange]);
    const consecutiveQualitySessions = this.countConsecutiveQualitySessions(exerciseName, [minRange, maxRange], 2);
    const [pullUpGatePassed, pullUpGateCount] = isPullUp ? this.pullUpGatePassed([minRange, maxRange], 2) : [true, 2];
    const progressionGatePassed = consecutiveQualitySessions >= 2 && pullUpGatePassed;

    const evaluateFatigueSignals = (stats: SessionStats) => {
      const rpeDeloadSignal =
        stats.topSetRpe >= DELOAD_RPE ||
        (stats.backoffSets > 0 && stats.backoffAvgRpe >= DELOAD_RPE);
      const severeRpeSignal =
        stats.topSetRpe >= DELOAD_RPE + 0.3 ||
        (stats.backoffSets > 0 && stats.backoffAvgRpe >= DELOAD_RPE + 0.3);
      const repsCrashSignal = isInclineDumbbellCurl
        ? (stats.backoffSets > 0 ? stats.backoffMinReps < minRange - 2 : stats.minReps < minRange - 1)
        : stats.minReps < minRange - 1;
      const dropoffSignal = isInclineDumbbellCurl ? stats.repDropoff >= 6 : stats.repDropoff >= 4;
      const fatigueSignalCount = [rpeDeloadSignal, repsCrashSignal, dropoffSignal].filter(Boolean).length;

      const shouldFatigueDeload = isInclineDumbbellCurl
        ? fatigueSignalCount >= 2 || (severeRpeSignal && (repsCrashSignal || dropoffSignal))
        : fatigueSignalCount >= 2 || (severeRpeSignal && repsCrashSignal);

      return {
        fatigueSignalCount,
        shouldFatigueDeload,
      };
    };

    const lastFatigue = evaluateFatigueSignals(lastStats);
    const previousStats = history.length > 1 ? this.getSessionStats(history[1], [minRange, maxRange]) : null;
    const previousFatigue = previousStats ? evaluateFatigueSignals(previousStats) : null;
    const loadJumpThreshold = Math.max(0.5, increment * 0.9);
    const loadJumpedLastSession = previousStats ? lastWeight > previousStats.topWeight + loadJumpThreshold : false;
    const overloadGuardTriggered =
      loadJumpedLastSession &&
      lastFatigue.shouldFatigueDeload &&
      !(previousFatigue?.shouldFatigueDeload ?? false);

    if (overloadGuardTriggered) {
      return buildTarget(
        lastWeight,
        minRange,
        "CONSOLIDATE",
        "Load jump detected. Hold steady and confirm a second bad session before any deload.",
        {
          backoffPercent,
          roundWeight: false,
          confidence: 82,
          previous: `Last: ${lastWeight}kg × ${JSON.stringify(lastReps)}`,
          isNew: false,
          trendInfo: trend,
          backoffNote,
          adjustmentReasons: [
            "Overload guard active: require 2 consecutive bad sessions after a load jump before deload.",
          ],
          bodyweightUsed: isPullUp ? currentBodyweight.bodyWeight : undefined,
          bodyweightStaleDays: isPullUp ? currentBodyweight.staleDays : undefined,
        },
      );
    }

    if (lastFatigue.shouldFatigueDeload) {
      const deloadFactor = lastFatigue.fatigueSignalCount >= 3 ? 0.9 : isInclineDumbbellCurl ? 0.94 : 0.95;
      const deloadWeight = roundToIncrement(lastWeight * deloadFactor);
      return buildTarget(deloadWeight, minRange, "DELOAD", `Fatigue cluster detected. Short reset to ${deloadWeight}kg, then rebuild.`, {
        backoffPercent,
        confidence: 90,
        isNew: false,
        trendInfo: trend,
        backoffNote,
        plateauInfo: isPlateaued ? plateauMsg : null,
        deloadPercent: Math.round((1 - deloadFactor) * 100),
        adjustmentReasons: this.programmingState.fatigue.reasons,
        bodyweightUsed: isPullUp ? currentBodyweight.bodyWeight : undefined,
        bodyweightStaleDays: isPullUp ? currentBodyweight.staleDays : undefined,
      });
    }

    const plateauHighRpe = lastStats.topSetRpe > MAX_RPE || (lastStats.backoffSets > 0 && lastStats.backoffAvgRpe > MAX_RPE);
    const highQualityRpe =
      lastStats.topSetRpe <= MAX_RPE - 0.5 &&
      (lastStats.backoffSets === 0 || lastStats.backoffAvgRpe <= MAX_RPE - 0.5);
    const acceptableRpe =
      lastStats.topSetRpe <= MAX_RPE &&
      (lastStats.backoffSets === 0 || lastStats.backoffAvgRpe <= MAX_RPE);

    const severePlateauDeload =
      isPlateaued && stallCount >= 4 && (trend.trend === "DECLINING" || plateauHighRpe);

    if (severePlateauDeload) {
      const deloadFactor = isInclineDumbbellCurl ? 0.95 : 0.96;
      const deloadWeight = roundToIncrement(lastWeight * deloadFactor);
      return buildTarget(deloadWeight, minRange, "DELOAD", `Plateau persisted. Strategic reset to ${deloadWeight}kg.`, {
        backoffPercent,
        confidence: 90,
        isNew: false,
        trendInfo: trend,
        backoffNote,
        plateauInfo: plateauMsg,
        deloadPercent: Math.round((1 - deloadFactor) * 100),
        adjustmentReasons: [plateauMsg],
        bodyweightUsed: isPullUp ? currentBodyweight.bodyWeight : undefined,
        bodyweightStaleDays: isPullUp ? currentBodyweight.staleDays : undefined,
      });
    }

    if (lastStats.minReps >= maxRange && highQualityRpe && trend.trend !== "DECLINING") {
      if (!progressionGatePassed) {
        const gateCount = isPullUp ? Math.min(consecutiveQualitySessions, pullUpGateCount) : consecutiveQualitySessions;
        return buildTarget(
          lastWeight,
          maxRange,
          "PUSH",
          `Progress gate in progress (${gateCount}/2 quality sessions). Repeat clean top-end work to unlock load increase.`,
          {
            backoffPercent,
            roundWeight: false,
            confidence: 84,
            previous: `Last: ${lastWeight}kg × ${JSON.stringify(lastReps)}`,
            isNew: false,
            trendInfo: trend,
            backoffNote,
            adjustmentReasons: ["Two-session quality gate required before adding load."],
            bodyweightUsed: isPullUp ? currentBodyweight.bodyWeight : undefined,
            bodyweightStaleDays: isPullUp ? currentBodyweight.staleDays : undefined,
          },
        );
      }

      const newWeight = roundToIncrement(lastWeight + increment);
      return buildTarget(newWeight, minRange, "PROGRESS", `Add weight! ${newWeight}kg × ${minRange} reps.`, {
        backoffPercent,
        confidence: 90,
        previous: `Last 3 avg e1RM: ${trend.avgE1rm ?? 0}kg`,
        isNew: false,
        trendInfo: trend,
        backoffNote,
        adjustmentReasons: ["Two-session quality gate met: load progression unlocked."],
        bodyweightUsed: isPullUp ? currentBodyweight.bodyWeight : undefined,
        bodyweightStaleDays: isPullUp ? currentBodyweight.staleDays : undefined,
      });
    }

    if (lastStats.avgReps >= maxRange - 0.5 && acceptableRpe) {
      return buildTarget(lastWeight, maxRange, "PUSH", `Hit ${maxRange} on all sets to unlock +${increment}kg.`, {
        backoffPercent,
        roundWeight: false,
        confidence: 80,
        previous: `Last: ${lastWeight}kg × ${JSON.stringify(lastReps)}`,
        isNew: false,
        trendInfo: trend,
        backoffNote,
        adjustmentReasons: ["Near progression threshold: keep quality high to finish the gate."],
        bodyweightUsed: isPullUp ? currentBodyweight.bodyWeight : undefined,
        bodyweightStaleDays: isPullUp ? currentBodyweight.staleDays : undefined,
      });
    }

    if (isPlateaued && highQualityRpe) {
      const targetReps = Math.min(maxRange, Math.max(Math.round(lastStats.avgReps), minRange));
      return buildTarget(lastWeight, targetReps, "VOLUME", "Stalled but fresh. Add one back-off set for extra volume.", {
        backoffPercent,
        roundWeight: false,
        confidence: 80,
        previous: `Last: ${lastWeight}kg × ${JSON.stringify(lastReps)}`,
        isNew: false,
        trendInfo: trend,
        backoffNote,
        plateauInfo: plateauMsg,
        suggestedExtraSets: 1,
        adjustmentReasons: [plateauMsg],
        bodyweightUsed: isPullUp ? currentBodyweight.bodyWeight : undefined,
        bodyweightStaleDays: isPullUp ? currentBodyweight.staleDays : undefined,
      });
    }

    if (isInclineDumbbellCurl && lastStats.avgReps < minRange) {
      const targetReps = Math.max(minRange - 1, Math.min(maxRange, lastStats.topSetReps + 1));
      return buildTarget(
        lastWeight,
        targetReps,
        "BUILD",
        "Top set is strong but fatigue builds fast. Keep load stable and spread quality across all sets.",
        {
          backoffPercent,
          roundWeight: false,
          confidence: 78,
          previous: `Last: ${lastWeight}kg × ${JSON.stringify(lastReps)}`,
          isNew: false,
          trendInfo: trend,
          backoffNote,
          bodyweightUsed: isPullUp ? currentBodyweight.bodyWeight : undefined,
          bodyweightStaleDays: isPullUp ? currentBodyweight.staleDays : undefined,
        },
      );
    }

    if (lastStats.avgReps >= minRange) {
      const targetReps = Math.min(Math.trunc(lastStats.avgReps) + 1, maxRange);
      return buildTarget(lastWeight, targetReps, "BUILD", `Target: ${displayLastWeight}kg × ${targetReps} reps.`, {
        backoffPercent,
        roundWeight: false,
        confidence: 75,
        previous: `Last: ${lastWeight}kg × ${JSON.stringify(lastReps)}`,
        isNew: false,
        trendInfo: trend,
        backoffNote,
        bodyweightUsed: isPullUp ? currentBodyweight.bodyWeight : undefined,
        bodyweightStaleDays: isPullUp ? currentBodyweight.staleDays : undefined,
      });
    }

    return buildTarget(
      lastWeight,
      minRange,
      "CONSOLIDATE",
      `Same weight (${displayLastWeight}kg), focus on clean ${minRange} reps.`,
      {
        backoffPercent,
        roundWeight: false,
        confidence: 70,
        previous: `Last: ${lastWeight}kg @ avg RPE ${lastStats.avgRpe.toFixed(1)}`,
        isNew: false,
        trendInfo: trend,
        backoffNote,
        plateauInfo: isPlateaued ? plateauMsg : null,
        bodyweightUsed: isPullUp ? currentBodyweight.bodyWeight : undefined,
        bodyweightStaleDays: isPullUp ? currentBodyweight.staleDays : undefined,
      },
    );
  }

  getWorkoutSummary(_workoutName: string, exercises: ExerciseConfig[]): WorkoutSummaryTarget[] {
    return exercises.map((exercise) => {
      const target = this.getNextTarget(exercise.name, exercise);
      return { ...target, exercise };
    });
  }

  getAllTimeStats(): AllTimeStats | null {
    if (!Object.keys(this.exerciseHistory).length) {
      return null;
    }

    const stats: AllTimeStats = {
      totalSessions: 0,
      totalSets: 0,
      totalReps: 0,
      totalVolume: 0,
      firstWorkout: null,
      lastWorkout: null,
      exercises: {},
      prList: [],
    };

    const allDates: string[] = [];

    for (const [exerciseName, history] of Object.entries(this.exerciseHistory)) {
      if (!history.length) {
        continue;
      }

      const exStats = {
        sessions: history.length,
        currentWeight: 0,
        maxWeight: 0,
        startingWeight: 0,
        weightGain: 0,
        totalVolume: 0,
        avgReps: 0,
      };

      const allReps: number[] = [];
      const weights: number[] = [];

      for (const session of history) {
        if (session.date) {
          allDates.push(session.date);
        }

        const sessionTopWeight = getSessionTopWeight(session);
        weights.push(sessionTopWeight);

        const sets = getSessionSets(session);
        for (const set of sets) {
          allReps.push(set.reps);
          stats.totalReps += set.reps;
          stats.totalVolume += set.weight * set.reps;
          stats.totalSets += 1;
        }
      }

      if (weights.length) {
        exStats.currentWeight = weights[0];
        exStats.maxWeight = Math.max(...weights);
        exStats.startingWeight = weights[weights.length - 1];
        exStats.weightGain = weights[0] - weights[weights.length - 1];
      }

      if (allReps.length) {
        exStats.avgReps = Number((allReps.reduce((sum, r) => sum + r, 0) / allReps.length).toFixed(1));
      }

      exStats.totalVolume = history.reduce((sum, h) => sum + getSessionVolume(h), 0);
      stats.exercises[exerciseName] = exStats;
      stats.totalSessions += history.length;

      if (exStats.maxWeight > 0) {
        stats.prList.push({ exercise: exerciseName, weight: exStats.maxWeight });
      }
    }

    if (allDates.length) {
      stats.firstWorkout = [...allDates].sort()[0].slice(0, 10);
      stats.lastWorkout = [...allDates].sort().at(-1)?.slice(0, 10) ?? null;
    }

    stats.prList.sort((a, b) => b.weight - a.weight);
    return stats;
  }
}

export function getWorkoutNameList(): WorkoutName[] {
  return Object.keys(EXERCISES) as WorkoutName[];
}

export function getAllMeasurementsSorted(measurements: MeasurementEntry[]): MeasurementEntry[] {
  return [...measurements].sort((a, b) => a.date.localeCompare(b.date));
}
