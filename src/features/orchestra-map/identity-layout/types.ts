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
 * positive `x` moves right and positive `y` moves down. Omitted fields use
 * the generic figure defaults.
 */
export type IdentityFigure = {
  src: string;
  width?: string;
  x?: string;
  y?: string;
  rotation?: string;
  scale?: number;
  opacity?: number;
  /** CSS mask-image value, for a broad fade on top of the master asset. */
  mask?: string;
};

export type IdentityLayout = {
  /** Offset from the chosen box anchor. Positive moves down. */
  top: IdentityOffset;
  /** Offset from the chosen box anchor. Positive moves right. */
  left: IdentityOffset;
  /** Any CSS font-size value, including clamp(), min(), vmin, vw and vh. */
  fontSize: string;
  /** A point on the selected constellation’s projected bounding box. */
  anchor: IdentityAnchor;
  /** Optional artwork composed with this orientation's caption. */
  figure?: IdentityFigure;
};

export type IdentityLayouts = Record<"portrait" | "landscape", IdentityLayout>;

/** Override any setting independently for either orientation. */
export type IdentityLayoutOverrides = Partial<
  Record<keyof IdentityLayouts, Partial<IdentityLayout>>
>;
