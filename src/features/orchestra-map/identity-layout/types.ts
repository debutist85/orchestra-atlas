import type { CaptionEdge, CaptionAlign, CaptionSide } from '../utils/caption-placement'
export type IdentityAnchor =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

/** Box-relative percentage, or a CSS clamp/min/max/calc length added to the anchor. */
export type IdentityOffset =
  | `${number}%`
  | `clamp(${string})`
  | `min(${string})`
  | `max(${string})`
  | `calc(${string})`;

/**
 * Atmospheric artwork behind a caption. Offsets are from the caption center;
 * positive `x` moves right and positive `y` moves down. Set `width`, `height`,
 * or both. The unset dimension resolves to `auto`. Other omitted fields use
 * the generic figure defaults.
 */
type IdentityFigureFields = {
  src: string;
  x?: string;
  y?: string;
  rotation?: string;
  scale?: number;
  opacity?: number;
  /** CSS mask-image value, for a broad fade on top of the master asset. */
  mask?: string;
};

export type IdentityFigure = IdentityFigureFields & (
  | { width: string; height?: string }
  | { width?: string; height: string }
);

export type IdentityLayout = {
  /** Nested caption group placement relative to the constellation bounds. */
  edge?: CaptionEdge;
  /** Alignment along the selected edge. */
  align?: CaptionAlign;
  /** Explicit bounding-box side. No automatic flipping. Defaults to outside. */
  side?: CaptionSide;
  /** Viewport-percent gap: vh for top/bottom, vw for left/right. Center ignores it. Defaults to 2. */
  gap?: number;
  /** Full-orchestra identity only: offset from its anchor. Positive moves down. */
  top: IdentityOffset;
  /** Full-orchestra identity only: offset from its anchor. Positive moves right. */
  left: IdentityOffset;
  /** Any CSS font-size value, including clamp(), min(), vmin, vw and vh. */
  fontSize: string;
  /** Full-orchestra identity only: legacy bounding-box anchor. */
  anchor: IdentityAnchor;
  /** Optional artwork composed with this orientation's caption. */
  figure?: IdentityFigure;
};

export type IdentityLayouts = Record<"portrait" | "landscape", IdentityLayout>;

/** Override any setting independently for either orientation. */
export type IdentityLayoutOverrides = Partial<
  Record<keyof IdentityLayouts, Partial<IdentityLayout>>
>;
