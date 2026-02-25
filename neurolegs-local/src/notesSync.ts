import { EXERCISE_META, TARGET_RPE } from "./constants";
import type { ParsedPlan, ParsedPlanEntry, SessionScheme, WorkoutSummaryTarget } from "./types";

function formatDate(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function buildTrainingPlanText(
  workout: string,
  targets: WorkoutSummaryTarget[],
  scheme: SessionScheme,
  date = new Date(),
): string {
  const lines: string[] = [];

  lines.push("NEUROLEGS NOTES TEMPLATE");
  lines.push(`Date: ${formatDate(date)}`);
  lines.push(`Workout: ${workout}`);
  lines.push("Edit only the numbers in each set line after training.");
  lines.push("If you skip an exercise, write: SKIP");
  lines.push("");

  for (const target of targets) {
    const { exercise } = target;
    const prescribedSets = Math.max(1, target.prescribedSets ?? exercise.sets);
    lines.push(`## ${exercise.name}`);

    if (EXERCISE_META[exercise.name]?.unilateral) {
      lines.push("Unilateral logging: write weakest side performance for each set.");
    }

    if (scheme === "Top Set + Back-off" && prescribedSets > 1) {
      lines.push(`1. ${target.weight} kg x ${target.repsPerSet} reps @8`);
      for (let i = 2; i <= prescribedSets; i += 1) {
        lines.push(`${i}. ${target.backoffWeight} kg x ${target.backoffReps} reps @8`);
      }
    } else {
      for (let i = 1; i <= prescribedSets; i += 1) {
        lines.push(`${i}. ${target.weight} kg x ${target.repsPerSet} reps @8`);
      }
    }

    lines.push("If skipped: write SKIP");
    lines.push("Notes:");
    lines.push("");
  }

  return lines.join("\n").trim();
}

function parseSetLine(line: string): { weight: number; reps: number; rpe: number } | null {
  const stripped = line
    .replace(/^\s*(?:[-*•]\s*|\d+\s*[.)]\s*)/, "")
    .replace(",", ".")
    .trim();

  if (!stripped) {
    return null;
  }

  const patterns = [
    /([0-9]+(?:\.[0-9]+)?)\s*kg\s*(?:x|×|\*|for|by|-)?\s*([0-9]+)\s*(?:reps?|r)?(?:.*?(?:@|rpe[:\s]*)\s*([0-9]+(?:\.[0-9]+)?))?/i,
    /([0-9]+(?:\.[0-9]+)?)\s*(?:x|×|\*)\s*([0-9]+)(?:\s*(?:reps?|r))?(?:.*?(?:@|rpe[:\s]*)\s*([0-9]+(?:\.[0-9]+)?))?/i,
    /^([0-9]+(?:\.[0-9]+)?)\s+([0-9]+)(?:\s+([0-9]+(?:\.[0-9]+)?))?$/i,
  ];

  for (const pattern of patterns) {
    const match = stripped.match(pattern);
    if (!match) {
      continue;
    }

    const weight = Number.parseFloat(match[1]);
    const reps = Number.parseInt(match[2], 10);
    const rpe = match[3] ? Number.parseFloat(match[3]) : TARGET_RPE;

    if (!Number.isFinite(weight) || !Number.isFinite(reps)) {
      continue;
    }

    return {
      weight,
      reps,
      rpe: Number.isFinite(rpe) ? rpe : TARGET_RPE,
    };
  }

  return null;
}

export function parseTrainingPlanText(content: string): ParsedPlan {
  const lines = content.split(/\r?\n/);
  const parsed: ParsedPlan = {
    date: null,
    workout: null,
    entries: [],
    diagnostics: {
      exerciseBlocks: 0,
      parsedSetLines: 0,
      skippedExercises: 0,
      ignoredLines: [],
    },
  };

  let current: ParsedPlanEntry | null = null;
  let inNotes = false;

  const flushCurrent = () => {
    if (!current) {
      return;
    }
    if (current.sets.length > 0 || current.skipped) {
      current.notes = current.notes.trim();
      parsed.entries.push(current);
    }
    current = null;
    inNotes = false;
  };

  lines.forEach((lineRaw) => {
    const line = lineRaw.trimEnd();

    if (!parsed.date) {
      const dateMatch = line.match(/^Date:\s*(.+)$/i);
      if (dateMatch) {
        parsed.date = dateMatch[1].trim();
      }
    }

    if (!parsed.workout) {
      const workoutMatch = line.match(/^Workout:\s*(.+)$/i);
      if (workoutMatch) {
        parsed.workout = workoutMatch[1].trim();
      }
    }

    const headingMatch = line.match(/^#{1,3}\s*(.+)$/) ?? line.match(/^Exercise:\s*(.+)$/i);
    if (headingMatch) {
      flushCurrent();
      parsed.diagnostics!.exerciseBlocks += 1;
      current = {
        exercise: headingMatch[1].trim(),
        sets: [],
        notes: "",
        skipped: false,
      };
      return;
    }

    if (!current) {
      return;
    }

    if (/^Notes:\s*$/i.test(line)) {
      inNotes = true;
      return;
    }

    const normalized = line.trim();
    const normalizedNoPrefix = normalized.replace(/^\s*(?:[-*•]\s*|\d+\s*[.)]\s*)/, "").trim();
    if (/^(?:x\s*)?(?:skip|skipped|rest|n\/a)(?:\b.*)?$/i.test(normalizedNoPrefix)) {
      current.skipped = true;
      current.sets = [];
      inNotes = false;
      parsed.diagnostics!.skippedExercises += 1;
      return;
    }

    if (current.skipped) {
      return;
    }

    const parsedSet = parseSetLine(line);
    if (parsedSet) {
      current.sets.push({
        weight: parsedSet.weight,
        reps: parsedSet.reps,
        rpe: parsedSet.rpe,
      });
      parsed.diagnostics!.parsedSetLines += 1;
      return;
    }

    if (inNotes && line.trim()) {
      current.notes += `${line.trim()}\n`;
      return;
    }

    if (/\d/.test(normalized) || /kg|reps?|rpe|x|×|\*/i.test(normalized)) {
      parsed.diagnostics!.ignoredLines.push(normalized);
    }
  });

  flushCurrent();
  return parsed;
}
