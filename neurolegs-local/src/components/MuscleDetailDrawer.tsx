import { BODY_HEATMAP_STATUS_LABELS, MUSCLE_GROUP_LABELS } from "../constants";
import type { BodyHeatmapState, MuscleGroup } from "../types";

type MuscleDetailDrawerProps = {
  heatmap: BodyHeatmapState;
  selectedGroup: MuscleGroup | null;
  onClose: () => void;
};

function formatDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function buildDistanceMessage(dose: number, min: number, max: number): string {
  if (dose <= 0) {
    return "No effective sets logged for this muscle yet this week.";
  }
  if (dose < min) {
    return `${(min - dose).toFixed(1)} sets needed to reach target minimum.`;
  }
  if (dose <= max) {
    return "Inside the optimal training zone.";
  }
  return `${(dose - max).toFixed(1)} sets above the optimal max.`;
}

export function MuscleDetailDrawer({ heatmap, selectedGroup, onClose }: MuscleDetailDrawerProps) {
  if (!selectedGroup) {
    return (
      <article className="card body-detail-drawer empty">
        <div className="card-header">
          <h3>Muscle Detail</h3>
        </div>
        <p className="pill note">Hover a muscle for a quick preview. Click one to open full breakdown.</p>
      </article>
    );
  }

  const muscle = heatmap.muscles[selectedGroup];
  const contributors = heatmap.contributorsByMuscle[selectedGroup];
  const sessions = heatmap.sessionsByMuscle[selectedGroup];

  return (
    <article className="card body-detail-drawer">
      <div className="card-header">
        <h3>{MUSCLE_GROUP_LABELS[selectedGroup]}</h3>
        <button className="button subtle drawer-close" onClick={onClose}>Clear</button>
      </div>

      <div className="drawer-topline">
        <span className={`badge status ${muscle.status.toLowerCase()}`}>{BODY_HEATMAP_STATUS_LABELS[muscle.status]}</span>
        <span className="drawer-score">Score {muscle.score.toFixed(1)}</span>
      </div>

      <div className="quick-grid">
        <div className="stat-card">
          <p className="stat-label">Effective Sets</p>
          <p className="stat-value">{muscle.dose.toFixed(1)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Target Range</p>
          <p className="stat-value">{muscle.targetMin}-{muscle.targetMax}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Optimal Center</p>
          <p className="stat-value">{muscle.optimalPoint.toFixed(1)}</p>
        </div>
      </div>

      <p className="pill warm">{buildDistanceMessage(muscle.dose, muscle.targetMin, muscle.targetMax)}</p>

      <section className="stack compact">
        <p className="field-label">Top Contributing Exercises</p>
        {contributors.length ? (
          <ul className="simple-list">
            {contributors.slice(0, 6).map((row) => (
              <li key={`${selectedGroup}-${row.exercise}`}>
                <strong>{row.exercise}</strong>: {row.effectiveSets.toFixed(1)} sets across {row.sessionCount} session{row.sessionCount > 1 ? "s" : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="pill note">No contributors for this week yet.</p>
        )}
      </section>

      <section className="stack compact">
        <p className="field-label">This Week Sessions</p>
        {sessions.length ? (
          <ul className="simple-list">
            {sessions.map((item) => (
              <li key={`${selectedGroup}-${item.date}-${item.exercise}`}>
                {formatDate(item.date)} - <strong>{item.exercise}</strong>: {item.effectiveSets.toFixed(1)} sets
              </li>
            ))}
          </ul>
        ) : (
          <p className="pill note">No session entries logged in this week window.</p>
        )}
      </section>
    </article>
  );
}
