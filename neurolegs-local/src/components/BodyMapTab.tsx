import { useMemo, useState } from "react";
import {
  BODY_HEATMAP_LEGEND_KEYS,
  BODY_HEATMAP_STATUS_LABELS,
  MUSCLE_GROUP_LABELS,
  MUSCLE_GROUP_ORDER,
} from "../constants";
import type { BodyHeatmapState, BodySide, MuscleGroup } from "../types";
import type { BodyMapHoverPayload } from "./MaleBodyMapSvg";
import { MaleBodyMapSvg } from "./MaleBodyMapSvg";
import { MuscleDetailDrawer } from "./MuscleDetailDrawer";

type BodyMapTabProps = {
  heatmap: BodyHeatmapState;
};

function round1(value: number): number {
  return Number(value.toFixed(1));
}

function formatWeekRange(start: string, end: string): string {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return `${start} -> ${end}`;
  }
  const startLabel = startDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel = endDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${startLabel} - ${endLabel}`;
}

function getLegendTicks(muscle: BodyHeatmapState["muscles"][MuscleGroup]): Array<{ key: string; value: number }> {
  const overValue = round1(muscle.targetMax + Math.max((muscle.targetMax - muscle.targetMin) * 0.5, 1));
  return [
    { key: BODY_HEATMAP_LEGEND_KEYS[0], value: 0 },
    { key: BODY_HEATMAP_LEGEND_KEYS[1], value: muscle.targetMin },
    { key: BODY_HEATMAP_LEGEND_KEYS[2], value: muscle.optimalPoint },
    { key: BODY_HEATMAP_LEGEND_KEYS[3], value: muscle.targetMax },
    { key: BODY_HEATMAP_LEGEND_KEYS[4], value: overValue },
  ];
}

export function BodyMapTab({ heatmap }: BodyMapTabProps) {
  const [side, setSide] = useState<BodySide>("front");
  const [selectedGroup, setSelectedGroup] = useState<MuscleGroup | null>(null);
  const [hover, setHover] = useState<BodyMapHoverPayload | null>(null);

  const focusedGroup = selectedGroup ?? hover?.group ?? MUSCLE_GROUP_ORDER[0];
  const focusedMuscle = heatmap.muscles[focusedGroup];
  const legendTicks = getLegendTicks(focusedMuscle);
  const legendMax = legendTicks.at(-1)?.value ?? Math.max(focusedMuscle.targetMax + 1, 1);

  const statusCounts = useMemo(() => {
    return MUSCLE_GROUP_ORDER.reduce((acc, group) => {
      const status = heatmap.muscles[group].status;
      acc[status] += 1;
      return acc;
    }, {
      NOT_TRAINED: 0,
      UNDER: 0,
      OPTIMAL: 0,
      ABOVE_OPTIMAL: 0,
    });
  }, [heatmap.muscles]);
  const totalEffectiveSets = useMemo(
    () => MUSCLE_GROUP_ORDER.reduce((sum, group) => sum + heatmap.muscles[group].dose, 0),
    [heatmap.muscles],
  );

  const hoveredMuscle = hover ? heatmap.muscles[hover.group] : null;

  return (
    <section className="stack body-map-tab">
      <article className="card body-map-header">
        <div className="card-header">
          <h3>Weekly Body Heatmap</h3>
          <span className="badge accent">Mon-Sun</span>
        </div>
        <p className="muted">
          Week window: <strong>{formatWeekRange(heatmap.weekStart, heatmap.weekEnd)}</strong>. Red to green shows readiness toward target, gold starts above optimal range.
        </p>
        <div className="panel-row">
          <button className={`button subtle ${side === "front" ? "active-toggle" : ""}`} onClick={() => setSide("front")}>Front View</button>
          <button className={`button subtle ${side === "back" ? "active-toggle" : ""}`} onClick={() => setSide("back")}>Back View</button>
        </div>
        {selectedGroup ? (
          <p className="pill success body-map-selection-pill">
            Locked selection: <strong>{MUSCLE_GROUP_LABELS[selectedGroup]}</strong>. Click the same region again to clear.
          </p>
        ) : (
          <p className="pill note body-map-selection-pill">Click any highlighted region to lock selection.</p>
        )}
        <p className={`pill ${totalEffectiveSets > 0 ? "warm" : "alert"}`}>
          Week detected effective sets (all groups combined): {totalEffectiveSets.toFixed(1)}
        </p>
        <div className="quick-grid">
          <div className="stat-card"><p className="stat-label">Not Trained</p><p className="stat-value">{statusCounts.NOT_TRAINED}</p></div>
          <div className="stat-card"><p className="stat-label">Under Target</p><p className="stat-value">{statusCounts.UNDER}</p></div>
          <div className="stat-card"><p className="stat-label">Optimal</p><p className="stat-value">{statusCounts.OPTIMAL}</p></div>
          <div className="stat-card"><p className="stat-label">Above Optimal</p><p className="stat-value">{statusCounts.ABOVE_OPTIMAL}</p></div>
        </div>
      </article>

      <div className="body-map-layout">
        <article className="card body-map-visual-card">
          <div className="body-map-canvas-wrap">
            <MaleBodyMapSvg
              side={side}
              muscles={heatmap.muscles}
              activeGroup={selectedGroup}
              hoveredGroup={hover?.group ?? null}
              onSelectGroup={(group) => setSelectedGroup((prev) => (prev === group ? null : group))}
              onHoverGroup={(payload) => setHover(payload)}
            />
          </div>

          {!selectedGroup && hoveredMuscle ? (
            <div
              className="body-map-tooltip"
              style={{
                left: hover ? hover.clientX + 12 : 0,
                top: hover ? hover.clientY + 12 : 0,
              }}
            >
              <p><strong>{MUSCLE_GROUP_LABELS[hoveredMuscle.group]}</strong></p>
              <p>{hoveredMuscle.dose.toFixed(1)} sets - {BODY_HEATMAP_STATUS_LABELS[hoveredMuscle.status]}</p>
            </div>
          ) : null}

          <section className="body-map-legend">
            <div className="legend-header">
              <p className="field-label">Scale for {MUSCLE_GROUP_LABELS[focusedGroup]}</p>
              <p className="muted">0 to target zone to above max</p>
            </div>
            <div className="legend-bar" />
            <div className="legend-ticks">
              {legendTicks.map((tick) => (
                <span key={`${focusedGroup}-${tick.key}`} style={{ left: `${(tick.value / Math.max(legendMax, 1)) * 100}%` }}>
                  <strong>{tick.key}</strong> {tick.value.toFixed(1)}
                </span>
              ))}
            </div>
          </section>

          <section className="body-map-muscle-grid">
            {MUSCLE_GROUP_ORDER.map((group) => {
              const datum = heatmap.muscles[group];
              return (
                <button
                  key={group}
                  className={`muscle-chip ${selectedGroup === group ? "active" : ""}`}
                  style={{ borderColor: datum.color }}
                  onClick={() => setSelectedGroup((prev) => (prev === group ? null : group))}
                >
                  <span className="dot" style={{ background: datum.color }} />
                  {MUSCLE_GROUP_LABELS[group]} ({datum.dose.toFixed(1)})
                </button>
              );
            })}
          </section>
        </article>

        <MuscleDetailDrawer
          heatmap={heatmap}
          selectedGroup={selectedGroup}
          onClose={() => setSelectedGroup(null)}
        />
      </div>
    </section>
  );
}
