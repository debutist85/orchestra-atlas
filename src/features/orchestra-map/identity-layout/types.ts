import type { CaptionEdge, CaptionAlign, CaptionSide } from '../utils/caption-placement'
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
  /** Any CSS font-size value, including clamp(), min(), vmin, vw and vh. */
  fontSize: string;
  /** Optional artwork composed with this orientation's caption. */
  figure?: IdentityFigure;
};

export type IdentityLayouts = Record<"portrait" | "landscape", IdentityLayout>;

/** Override any setting independently for either orientation. */
export type IdentityLayoutOverrides = Partial<
  Record<keyof IdentityLayouts, Partial<IdentityLayout>>
>;
