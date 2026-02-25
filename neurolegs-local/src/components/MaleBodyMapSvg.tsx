import { useId } from "react";
import { BODY_HEATMAP_COLORS, BODY_HEATMAP_STATUS_LABELS, MUSCLE_GROUP_LABELS } from "../constants";
import type { BodySide, MuscleGroup, MuscleHeatDatum } from "../types";
import bodyMapImage from "../assets/musclemap2.png";
import { BODY_MAP_IMAGE_SIZE, BODY_MAP_VIEWBOX, BODY_MUSCLE_REGIONS } from "./bodyMapGeometry";

export type BodyMapHoverPayload = {
  group: MuscleGroup;
  clientX: number;
  clientY: number;
};

type MaleBodyMapSvgProps = {
  side: BodySide;
  muscles: Record<MuscleGroup, MuscleHeatDatum>;
  activeGroup: MuscleGroup | null;
  hoveredGroup: MuscleGroup | null;
  onSelectGroup: (group: MuscleGroup) => void;
  onHoverGroup: (payload: BodyMapHoverPayload | null) => void;
};

function getRegionAriaLabel(group: MuscleGroup, muscles: Record<MuscleGroup, MuscleHeatDatum>): string {
  const datum = muscles[group];
  return `${MUSCLE_GROUP_LABELS[group]}, ${datum.dose.toFixed(1)} effective sets, ${BODY_HEATMAP_STATUS_LABELS[datum.status]}`;
}

export function MaleBodyMapSvg({
  side,
  muscles,
  activeGroup,
  hoveredGroup,
  onSelectGroup,
  onHoverGroup,
}: MaleBodyMapSvgProps) {
  const gradientId = useId().replace(/:/g, "");
  const visibleRegions = BODY_MUSCLE_REGIONS.filter((region) => region.side === side);
  const view = BODY_MAP_VIEWBOX[side];
  const hasLockedSelection = activeGroup !== null;

  return (
    <svg
      className="male-map-svg"
      viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
      role="img"
      aria-label={`Male body ${side} view muscle heatmap`}
    >
      <defs>
        <linearGradient id={`region-fade-${gradientId}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.85)" />
        </linearGradient>
        <filter id={`base-desat-${gradientId}`}>
          <feColorMatrix
            type="matrix"
            values="0.33 0.33 0.33 0 0
                    0.33 0.33 0.33 0 0
                    0.33 0.33 0.33 0 0
                    0    0    0    1 0"
          />
          <feComponentTransfer>
            <feFuncR type="gamma" amplitude="0.78" exponent="1" offset="0" />
            <feFuncG type="gamma" amplitude="0.78" exponent="1" offset="0" />
            <feFuncB type="gamma" amplitude="0.78" exponent="1" offset="0" />
          </feComponentTransfer>
        </filter>
        <radialGradient id={`panel-glow-${gradientId}`} cx="50%" cy="8%" r="68%">
          <stop offset="0%" stopColor="rgba(28, 239, 221, 0.14)" />
          <stop offset="70%" stopColor="rgba(28, 239, 221, 0)" />
        </radialGradient>
      </defs>

      <rect x={view.x} y={view.y} width={view.width} height={view.height} fill={`url(#panel-glow-${gradientId})`} />
      <image
        href={bodyMapImage}
        x={0}
        y={0}
        width={BODY_MAP_IMAGE_SIZE.width}
        height={BODY_MAP_IMAGE_SIZE.height}
        filter={`url(#base-desat-${gradientId})`}
        className="body-reference-image"
      />

      {hasLockedSelection ? (
        <rect
          x={view.x}
          y={view.y}
          width={view.width}
          height={view.height}
          fill="rgba(7, 14, 26, 0.28)"
          pointerEvents="none"
        />
      ) : null}

      {visibleRegions.map((region) => {
        const muscle = muscles[region.group];
        const isSelected = activeGroup === region.group;
        const isHovered = hoveredGroup === region.group;
        const isDimmed = hasLockedSelection && !isSelected;
        const isTrained = muscle.dose > 0;
        const strokeColor = isSelected
          ? "#f8fbff"
          : isHovered && !hasLockedSelection
            ? "#dbeafe"
            : BODY_HEATMAP_COLORS.regionStroke;
        const strokeWidth = isSelected ? 2.8 : isHovered && !hasLockedSelection ? 2.1 : 1.4;
        const fillOpacity = isSelected
          ? 0.95
          : isDimmed
            ? 0.16
            : isHovered
              ? (isTrained ? 0.92 : 0.72)
              : (isTrained ? 0.84 : 0.58);
        const filter = isSelected
          ? `drop-shadow(0 0 18px ${BODY_HEATMAP_COLORS.glow})`
          : isHovered && !hasLockedSelection
            ? `drop-shadow(0 0 10px ${BODY_HEATMAP_COLORS.glow})`
            : "none";
        return (
          <path
            key={region.id}
            d={region.d}
            tabIndex={0}
            role="button"
            aria-label={getRegionAriaLabel(region.group, muscles)}
            className={[
              "muscle-region",
              isSelected ? "selected" : "",
              isDimmed ? "dimmed" : "",
              isHovered ? "hovered" : "",
            ].filter(Boolean).join(" ")}
            style={{
              fill: muscle.color,
              stroke: strokeColor,
              strokeWidth,
              fillOpacity,
              mixBlendMode: "normal",
              vectorEffect: "non-scaling-stroke",
              filter,
            }}
            onClick={() => onSelectGroup(region.group)}
            onMouseEnter={(event) => onHoverGroup({ group: region.group, clientX: event.clientX, clientY: event.clientY })}
            onMouseMove={(event) => onHoverGroup({ group: region.group, clientX: event.clientX, clientY: event.clientY })}
            onMouseLeave={() => onHoverGroup(null)}
            onFocus={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              onHoverGroup({
                group: region.group,
                clientX: bounds.left + bounds.width / 2,
                clientY: bounds.top + bounds.height / 2,
              });
            }}
            onBlur={() => onHoverGroup(null)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectGroup(region.group);
              }
            }}
          />
        );
      })}

      {visibleRegions.map((region) => {
        const isSelected = activeGroup === region.group;
        const isHoverHighlight = !hasLockedSelection && hoveredGroup === region.group;
        if (!isSelected && !isHoverHighlight) {
          return null;
        }
        return (
          <path
            key={`${region.id}-highlight`}
            d={region.d}
            fill="none"
            stroke={isSelected ? "#ffffff" : `url(#region-fade-${gradientId})`}
            strokeWidth={isSelected ? 3.8 : 2.2}
            pointerEvents="none"
            className={`muscle-region-highlight ${isSelected ? "locked" : ""}`}
          />
        );
      })}
    </svg>
  );
}
