import type {
  BaseSchedule,
  ExerciseConfig,
  ExerciseMeta,
  MuscleHeatStatus,
  MuscleGroup,
  MuscleTargetRange,
  Settings,
  WorkoutName,
} from "./types";

export const APP_TITLE = "NeuroLegs";
export const APP_PASSWORD = "01012026";

export const USER_PROFILE = {
  weightKg: 61.1,
  age: 22,
  proteinG: 125,
  carbsG: 415,
  fatsG: 60,
  supplements: { creatineG: 5, maltodextrinG: 40, wheyG: 30 },
};

export const BASE_SCHEDULE: BaseSchedule = {
  0: "Legs A",
  1: "Rest",
  2: "Legs B",
  3: "Session D",
  4: "Legs C",
  5: "Rest",
  6: "Rest",
};

export const WEIGHT_INCREMENT = { compound: 2.5, isolation: 1.25 };
export const BACKOFF_PERCENT = 0.9;
export const BACKOFF_MIN_PERCENT = 0.8;
export const BACKOFF_MAX_PERCENT = 0.95;
export const TARGET_RPE = 8.0;
export const MAX_RPE = 9.0;
export const DELOAD_RPE = 9.5;
export const ENABLE_PROGRESSION_V2 = true;

export const COMPOUND_EXERCISES = [
  "High Bar Squat",
  "Romanian Deadlift",
  "Leg Press",
  "Unilateral Leg Press",
  "Hack Squat",
  "Hip Thrust",
  "Machine Chest Press (Seated)",
  "Machine Chest Press (Lying)",
  "Seated Cable Row",
  "Seated Lat Pulldown",
  "Bulgarian Split Squat",
  "Pull-Up (Weighted)",
  "Unilateral Plate-Loaded Pulldown",
];

export const MACHINE_STACK_EXERCISES = new Set([
  "Leg Extension",
  "Leg Extension (Drop Set)",
  "Leg Press",
  "Seated Leg Curl",
  "Unilateral Leg Press",
  "Adductor Machine",
  "Lying Leg Curl",
  "Pec Deck",
  "Reverse Pec Deck",
]);

export const LB_TO_KG = 0.45359237;
export const KG_TO_LB = 1 / LB_TO_KG;
export const MACHINE_STACK_BASE_KG = 13.5;
export const MACHINE_STACK_STEP_KG = 9.0;
export const MACHINE_STACK_MICRO_LB = [0, 5, 10, 15];
export const MACHINE_STACK_MAX_KG = 300.0;

export const FIXED_EXERCISE_WEIGHTS_KG: Record<string, number[]> = {
  "Incline Dumbbell Curl": [8, 9, 10, 12, 14, 16, 18],
};

export const EXERCISES: Record<WorkoutName, ExerciseConfig[]> = {
  "Legs A": [
    {
      name: "High Bar Squat",
      sets: 3,
      repRange: [5, 8],
      rest: "3 min",
      restSeconds: 180,
      video: "https://www.youtube.com/watch?v=eMYjBnIVb_A",
      notes: "Primary quad builder. Brace hard, hit depth.",
    },
    {
      name: "Leg Extension",
      sets: 3,
      repRange: [10, 12],
      rest: "90s",
      restSeconds: 90,
      video: "https://www.youtube.com/watch?v=WaRl1k71iT0",
      notes: "Squeeze at top, control the negative.",
    },
    {
      name: "Leg Press",
      sets: 3,
      repRange: [10, 12],
      rest: "2 min",
      restSeconds: 120,
      video: "https://www.youtube.com/watch?v=8nm863C0c60",
      notes: "Feet shoulder-width, full ROM.",
    },
    {
      name: "Seated Leg Curl",
      sets: 3,
      repRange: [12, 15],
      rest: "90s",
      restSeconds: 90,
      video: "https://www.youtube.com/watch?v=OrxowZ4l3yI",
      notes: "Point toes, squeeze hamstrings.",
    },
    {
      name: "Seated Calf Raise",
      sets: 4,
      repRange: [15, 20],
      rest: "60s",
      restSeconds: 60,
      video: "https://www.youtube.com/watch?v=-M4-G8p8fmc",
      notes: "Soleus focus. Deep stretch, hard squeeze.",
    },
    {
      name: "Triceps Rope Pushdown",
      sets: 3,
      repRange: [12, 15],
      rest: "60s",
      restSeconds: 60,
      video: "https://www.youtube.com/watch?v=vB5OHsJ3EME",
      notes: "Elbows pinned, full extension, slow return.",
    },
    {
      name: "Incline Dumbbell Curl",
      sets: 3,
      repRange: [10, 12],
      rest: "75s",
      restSeconds: 75,
      video: "https://www.youtube.com/watch?v=soxrZlIl35U",
      notes: "Full stretch, supinate hard, control the negative.",
    },
  ],
  "Legs B": [
    {
      name: "Romanian Deadlift",
      sets: 3,
      repRange: [8, 10],
      rest: "3 min",
      restSeconds: 180,
      video: "https://www.youtube.com/watch?v=JCXUYuzwNrM",
      notes: "Hinge pattern. Feel the hamstring stretch.",
    },
    {
      name: "Unilateral Leg Press",
      sets: 3,
      repRange: [10, 12],
      rest: "2 min",
      restSeconds: 120,
      video: "https://www.youtube.com/watch?v=8nm863C0c60",
      notes: "One leg at a time. Balance strength.",
    },
    {
      name: "Lying Leg Curl",
      sets: 3,
      repRange: [12, 15],
      rest: "60s",
      restSeconds: 60,
      video: "https://www.youtube.com/watch?v=1Tq3QdYUuHs",
      notes: "Squeeze hard at peak contraction.",
    },
    {
      name: "Adductor Machine",
      sets: 3,
      repRange: [15, 20],
      rest: "60s",
      restSeconds: 60,
      video: "https://www.youtube.com/watch?v=KaEp53Hj-EU",
      notes: "Inner thigh focus. Control both phases.",
    },
    {
      name: "Machine Chest Press (Seated)",
      sets: 3,
      repRange: [8, 12],
      rest: "2 min",
      restSeconds: 120,
      video: "https://www.youtube.com/watch?v=VmB1G1K7v94",
      notes: "Choose seated or lying chest press based on availability.",
    },
    {
      name: "Machine Chest Press (Lying)",
      sets: 3,
      repRange: [8, 12],
      rest: "2 min",
      restSeconds: 120,
      video: "https://www.youtube.com/watch?v=VmB1G1K7v94",
      notes: "Choose seated or lying chest press based on availability.",
    },
    {
      name: "Pec Deck",
      sets: 3,
      repRange: [12, 15],
      rest: "75s",
      restSeconds: 75,
      video: "https://www.youtube.com/watch?v=U6T6l1a1m4M",
      notes: "Squeeze chest, slight bend in elbows.",
    },
    {
      name: "Seated Calf Raise",
      sets: 4,
      repRange: [15, 20],
      rest: "60s",
      restSeconds: 60,
      video: "https://www.youtube.com/watch?v=-M4-G8p8fmc",
      notes: "Soleus focus. Deep stretch, hard squeeze.",
    },
  ],
  "Legs C": [
    {
      name: "Bulgarian Split Squat",
      sets: 3,
      repRange: [8, 12],
      rest: "90s",
      restSeconds: 90,
      video: "https://www.youtube.com/watch?v=2C-uNgKwPLE",
      notes: "Torso tall, knee tracks toes, full depth each leg.",
    },
    {
      name: "Hip Thrust",
      sets: 3,
      repRange: [10, 12],
      rest: "2 min",
      restSeconds: 120,
      video: "https://www.youtube.com/watch?v=xDmFkJxPzeM",
      notes: "Glute focus. Full hip extension.",
    },
    {
      name: "Leg Extension (Drop Set)",
      sets: 3,
      repRange: [15, 20],
      rest: "90s",
      restSeconds: 90,
      video: "https://www.youtube.com/watch?v=WaRl1k71iT0",
      notes: "Drop weight 20% after failure, continue.",
    },
    {
      name: "Seated Leg Curl",
      sets: 3,
      repRange: [15, 20],
      rest: "60s",
      restSeconds: 60,
      video: "https://www.youtube.com/watch?v=OrxowZ4l3yI",
      notes: "High reps, chase the pump.",
    },
    {
      name: "Cable Lateral Raise (Unilateral)",
      sets: 3,
      repRange: [12, 18],
      rest: "60-75s",
      restSeconds: 75,
      video: "https://www.youtube.com/watch?v=I0EBQ5dHjYU",
      notes:
        "Stand side-on and hold the cable slightly behind your hip. Raise in the scapular plane (arm slightly forward), lead with elbow, keep wrist neutral, stop around shoulder height before shrugging. Brace with free hand, slight lean away, 1s pause at top, 2-3s lowering.",
    },
    {
      name: "Reverse Pec Deck",
      sets: 3,
      repRange: [12, 20],
      rest: "60-75s",
      restSeconds: 75,
      video: "https://www.youtube.com/watch?v=EA7u4Q_8HQ0",
      notes: "Set seat so handles align with rear delts. Soft elbows, open arms wide, and finish with shoulder blades moving around the ribcage, not lower-back extension.",
    },
    {
      name: "Calf Press",
      sets: 3,
      repRange: [20, 25],
      rest: "45s",
      restSeconds: 45,
      video: "https://www.youtube.com/watch?v=K_jsGgztcGU",
      notes: "Leg press machine. Burn it out.",
    },
  ],
  "Session D": [
    {
      name: "Pull-Up (Weighted)",
      sets: 4,
      repRange: [6, 10],
      rest: "2-3 min",
      restSeconds: 150,
      video: "https://www.youtube.com/watch?v=eGo4IYlbE5g",
      notes: "Unassisted baseline. When you hit 4x10 clean for 1-2 sessions, add +2.5kg (or +1.25kg) and rebuild from 6-8 reps.",
    },
    {
      name: "Unilateral Plate-Loaded Pulldown",
      sets: 4,
      repRange: [8, 12],
      rest: "90-120s",
      restSeconds: 120,
      video: "https://www.youtube.com/watch?v=CAwf7n6Luuc",
      notes: "Top-to-down unilateral path. Keep shoulder down, slight torso lean, elbow tracks toward your hip, and avoid twisting.",
    },
    {
      name: "Seated Lat Pulldown",
      sets: 3,
      repRange: [8, 12],
      rest: "90s",
      restSeconds: 90,
      video: "https://www.youtube.com/watch?v=CAwf7n6Luuc",
      notes: "Use long straight bar (barre droite longue), overhand grip just outside shoulder width, pull to upper chest with elbows driving down.",
    },
    {
      name: "Seated Cable Row",
      sets: 3,
      repRange: [10, 14],
      rest: "90s",
      restSeconds: 90,
      video: "https://www.youtube.com/watch?v=HJSVR_67OlM",
      notes: "Pull toward upper chest with neutral spine and slight chest support from your brace; do not swing torso.",
    },
    {
      name: "Incline Dumbbell Triceps Extension",
      sets: 4,
      repRange: [10, 15],
      rest: "75-90s",
      restSeconds: 90,
      video: "https://www.youtube.com/watch?v=YbX7Wd8jQ-Q",
      notes: "Slight incline bench. Let DB travel behind forehead for deep triceps stretch, then extend without flaring elbows.",
    },
    {
      name: "Triceps Rope Pushdown",
      sets: 3,
      repRange: [12, 15],
      rest: "60-75s",
      restSeconds: 75,
      video: "https://www.youtube.com/watch?v=vB5OHsJ3EME",
      notes: "Elbows fixed, shoulders down, split rope at bottom with full lockout and slow return.",
    },
    {
      name: "Incline Dumbbell Curl",
      sets: 3,
      repRange: [8, 12],
      rest: "75s",
      restSeconds: 75,
      video: "https://www.youtube.com/watch?v=soxrZlIl35U",
      notes: "Full shoulder extension for stretch, supinate hard, and control eccentric.",
    },
    {
      name: "Hammer Curl",
      sets: 2,
      repRange: [10, 14],
      rest: "60-75s",
      restSeconds: 75,
      video: "https://www.youtube.com/watch?v=zC3nLlEvin4",
      notes: "Neutral grip, elbows by sides, slight forward DB path, no hip swing.",
    },
    {
      name: "Preacher Curl",
      sets: 2,
      repRange: [10, 14],
      rest: "60-75s",
      restSeconds: 75,
      video: "https://www.youtube.com/watch?v=fIWP-FRFNU0",
      notes: "Upper arm fixed on pad, full elbow extension under control, squeeze top without lifting elbow off pad.",
    },
  ],
};

export const MUSCLE_GROUP_ORDER: MuscleGroup[] = [
  "quads",
  "hamstrings",
  "calves",
  "back",
  "biceps",
  "triceps",
  "chest",
  "shoulders",
];

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  quads: "Quads",
  hamstrings: "Hamstrings",
  calves: "Calves",
  back: "Back",
  biceps: "Biceps",
  triceps: "Triceps",
  chest: "Chest",
  shoulders: "Shoulders",
};

export const MUSCLE_TARGET_RANGES: Record<MuscleGroup, MuscleTargetRange> = {
  // Tuned to the current weekly split with unilateral work counted per side.
  quads: { min: 18, max: 24 },
  hamstrings: { min: 17, max: 22 },
  calves: { min: 10, max: 14 },
  back: { min: 12, max: 16 },
  biceps: { min: 13, max: 17 },
  triceps: { min: 10, max: 14 },
  chest: { min: 5, max: 9 },
  shoulders: { min: 8, max: 11 },
};

export const BODY_HEATMAP_COLORS = {
  notTrained: "#8b98ad",
  underMin: "#c3272e",
  optimal: "#22c55e",
  aboveMin: "#d4a017",
  aboveMax: "#ffe08a",
  regionStroke: "#0f172a",
  glow: "rgba(23, 198, 186, 0.38)",
};

export const BODY_HEATMAP_STATUS_LABELS: Record<MuscleHeatStatus, string> = {
  NOT_TRAINED: "Not trained",
  UNDER: "Under target",
  OPTIMAL: "Optimal",
  ABOVE_OPTIMAL: "Above optimal",
};

export const BODY_HEATMAP_LEGEND_KEYS = ["0", "MIN", "CENTER", "MAX", "OVER"] as const;

export const EXERCISE_META: Record<string, ExerciseMeta> = {
  "High Bar Squat": {
    primaryGroup: "quads",
    groupContribution: { quads: 0.7, hamstrings: 0.3 },
    minSets: 2,
    maxSets: 4,
  },
  "Leg Extension": {
    primaryGroup: "quads",
    groupContribution: { quads: 1 },
    minSets: 2,
    maxSets: 4,
  },
  "Leg Press": {
    primaryGroup: "quads",
    groupContribution: { quads: 0.75, hamstrings: 0.25 },
    minSets: 2,
    maxSets: 4,
  },
  "Seated Leg Curl": {
    primaryGroup: "hamstrings",
    groupContribution: { hamstrings: 1 },
    minSets: 2,
    maxSets: 4,
  },
  "Lying Leg Curl": {
    primaryGroup: "hamstrings",
    groupContribution: { hamstrings: 1 },
    minSets: 2,
    maxSets: 4,
  },
  "Romanian Deadlift": {
    primaryGroup: "hamstrings",
    groupContribution: { hamstrings: 0.8, quads: 0.2 },
    minSets: 2,
    maxSets: 4,
  },
  "Unilateral Leg Press": {
    primaryGroup: "quads",
    groupContribution: { quads: 0.7, hamstrings: 0.3 },
    unilateral: true,
    minSets: 2,
    maxSets: 4,
  },
  "Bulgarian Split Squat": {
    primaryGroup: "quads",
    groupContribution: { quads: 0.6, hamstrings: 0.4 },
    unilateral: true,
    minSets: 2,
    maxSets: 4,
  },
  "Hip Thrust": {
    primaryGroup: "hamstrings",
    groupContribution: { hamstrings: 0.7, quads: 0.3 },
    minSets: 2,
    maxSets: 4,
  },
  "Leg Extension (Drop Set)": {
    primaryGroup: "quads",
    groupContribution: { quads: 1 },
    minSets: 2,
    maxSets: 4,
  },
  "Adductor Machine": {
    primaryGroup: "hamstrings",
    groupContribution: { hamstrings: 0.55, quads: 0.45 },
    minSets: 2,
    maxSets: 4,
  },
  "Seated Calf Raise": {
    primaryGroup: "calves",
    groupContribution: { calves: 1 },
    minSets: 3,
    maxSets: 5,
  },
  "Calf Press": {
    primaryGroup: "calves",
    groupContribution: { calves: 1 },
    minSets: 2,
    maxSets: 4,
  },
  "Pull-Up (Weighted)": {
    primaryGroup: "back",
    groupContribution: { back: 0.75, biceps: 0.25 },
    bodyweight: true,
    minSets: 3,
    maxSets: 5,
  },
  "Unilateral Plate-Loaded Pulldown": {
    primaryGroup: "back",
    groupContribution: { back: 0.75, biceps: 0.25 },
    unilateral: true,
    minSets: 3,
    maxSets: 5,
  },
  "Seated Lat Pulldown": {
    primaryGroup: "back",
    groupContribution: { back: 0.75, biceps: 0.25 },
    minSets: 2,
    maxSets: 4,
  },
  "Seated Cable Row": {
    primaryGroup: "back",
    groupContribution: { back: 0.75, biceps: 0.25 },
    minSets: 2,
    maxSets: 4,
  },
  "Incline Dumbbell Curl": {
    primaryGroup: "biceps",
    groupContribution: { biceps: 1 },
    minSets: 2,
    maxSets: 4,
  },
  "Hammer Curl": {
    primaryGroup: "biceps",
    groupContribution: { biceps: 1 },
    minSets: 1,
    maxSets: 4,
  },
  "Preacher Curl": {
    primaryGroup: "biceps",
    groupContribution: { biceps: 1 },
    minSets: 1,
    maxSets: 4,
  },
  "Triceps Rope Pushdown": {
    primaryGroup: "triceps",
    groupContribution: { triceps: 1 },
    minSets: 2,
    maxSets: 4,
  },
  "Incline Dumbbell Triceps Extension": {
    primaryGroup: "triceps",
    groupContribution: { triceps: 1 },
    minSets: 2,
    maxSets: 5,
  },
  "Machine Chest Press (Seated)": {
    primaryGroup: "chest",
    groupContribution: { chest: 0.8, triceps: 0.2 },
    minSets: 2,
    maxSets: 4,
  },
  "Machine Chest Press (Lying)": {
    primaryGroup: "chest",
    groupContribution: { chest: 0.8, triceps: 0.2 },
    minSets: 2,
    maxSets: 4,
  },
  "Pec Deck": {
    primaryGroup: "chest",
    groupContribution: { chest: 1 },
    minSets: 2,
    maxSets: 4,
  },
  "Cable Lateral Raise (Unilateral)": {
    primaryGroup: "shoulders",
    groupContribution: { shoulders: 1 },
    unilateral: true,
    minSets: 2,
    maxSets: 4,
  },
  "Reverse Pec Deck": {
    primaryGroup: "shoulders",
    groupContribution: { shoulders: 1 },
    minSets: 2,
    maxSets: 4,
  },
  "Hack Squat": {
    primaryGroup: "quads",
    groupContribution: { quads: 0.7, hamstrings: 0.3 },
    minSets: 2,
    maxSets: 4,
  },
};

export const UNILATERAL_EXERCISES = new Set(
  Object.entries(EXERCISE_META)
    .filter(([, meta]) => Boolean(meta.unilateral))
    .map(([exerciseName]) => exerciseName),
);

export const MEAL_PLANS = {
  "Option 1 - Clean/Rice": {
    breakfast: {
      name: "Power Oats",
      items: ["100g Oats", "1 Scoop Whey", "1 Banana", "Drizzle of Honey"],
      timing: "08:00",
    },
    lunch: {
      name: "Chicken & Rice",
      items: ["150g Chicken Breast", "300g Basmati Rice", "Mixed Veggies", "1 tbsp Olive Oil"],
      timing: "12:30",
      note: "Walk 15 min after eating",
    },
    preWorkout: {
      name: "Quick Carbs",
      items: ["2 Slices Toast", "30g Jam"],
      timing: "60 min before gym",
    },
    postWorkout: {
      name: "Recovery Shake",
      items: ["30g Whey", "40g Maltodextrin", "5g Creatine"],
      timing: "Within 30 min of training",
    },
    dinner: {
      name: "Eggs & Potatoes",
      items: ["3 Whole Eggs", "2 Large Potatoes", "1 Apple"],
      timing: "20:00",
    },
  },
  "Option 2 - Dense/Pasta": {
    breakfast: {
      name: "Protein Pancakes",
      items: ["100g Oat Flour", "1 Banana", "Egg Whites", "Sugar-free Syrup"],
      timing: "08:00",
    },
    lunch: {
      name: "Beef Pasta",
      items: ["120g Lean Ground Beef", "150g Dry Pasta", "Marinara Sauce"],
      timing: "12:30",
      note: "Walk 15 min after eating",
    },
    preWorkout: {
      name: "Cereal Boost",
      items: ["40g Cereal", "200ml Milk"],
      timing: "60 min before gym",
    },
    postWorkout: {
      name: "Recovery Shake",
      items: ["30g Whey", "40g Maltodextrin", "5g Creatine"],
      timing: "Within 30 min of training",
    },
    dinner: {
      name: "Fish & Rice",
      items: ["150g White Fish", "300g Rice", "1/2 Avocado", "Glass of Juice"],
      timing: "20:00",
    },
  },
};

export const STARTING_WEIGHTS: Record<string, number> = {
  "High Bar Squat": 40,
  "Leg Extension": 20,
  "Leg Press": 60,
  "Seated Leg Curl": 15,
  "Romanian Deadlift": 40,
  "Unilateral Leg Press": 30,
  "Lying Leg Curl": 15,
  "Adductor Machine": 20,
  "Seated Calf Raise": 25,
  "Hack Squat": 40,
  "Hip Thrust": 40,
  "Leg Extension (Drop Set)": 15,
  "Calf Press": 60,
  "Triceps Rope Pushdown": 17.5,
  "Incline Dumbbell Curl": 10,
  "Machine Chest Press (Seated)": 30,
  "Machine Chest Press (Lying)": 30,
  "Pec Deck": 25,
  "Reverse Pec Deck": 25,
  "Seated Cable Row": 35,
  "Seated Lat Pulldown": 47.5,
  "Bulgarian Split Squat": 10,
  "Cable Lateral Raise (Unilateral)": 5,
  "Pull-Up (Weighted)": 0,
  "Unilateral Plate-Loaded Pulldown": 20,
  "Incline Dumbbell Triceps Extension": 9,
  "Hammer Curl": 10,
  "Preacher Curl": 27.5,
};

export const DEFAULT_SETTINGS: Settings = {
  mealPlan: "Option 1 - Clean/Rice",
  holidayMode: false,
  holidayStart: null,
  scheduleOffset: 0,
  progressionState: {
    waveAnchorDate: null,
    earlyPivotActive: false,
  },
};
