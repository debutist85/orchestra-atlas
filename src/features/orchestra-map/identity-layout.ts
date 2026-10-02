import { familyIdentityLayouts, orchestraIdentityLayout } from "./identity-layout/families";
import { instrumentIdentityLayouts } from "./identity-layout/instruments";
import type {
  IdentityAnchor,
  IdentityFigure,
  IdentityLayouts,
} from "./identity-layout/types";
import type { NavigationState } from "./utils/navigation";
import { mediaUrl } from "../../lib/media-url";

export { familyLayout, instrumentLayout } from "./identity-layout/defaults";
export type {
  IdentityAnchor,
  IdentityFigure,
  IdentityLayout,
  IdentityLayoutOverrides,
  IdentityLayouts,
  IdentityOffset,
} from "./identity-layout/types";

export function identityAnchorEdges(anchor: IdentityAnchor) {
  const [vertical, horizontal] = anchor.split("-") as [
    "top" | "bottom",
    "left" | "center" | "right",
  ];
  return { x: horizontal, y: vertical };
}

/** Stage typography only; no navigation state, camera, or geometry settings. */
export const identityLayouts = {
  orchestra: orchestraIdentityLayout,
  families: familyIdentityLayouts,
  instruments: instrumentIdentityLayouts,
};

function layoutsFor(navigation: NavigationState): IdentityLayouts {
  if (navigation.level === "orchestra") return identityLayouts.orchestra;
  if (navigation.level === "family") return identityLayouts.families[navigation.familyId];
  return identityLayouts.instruments[navigation.instrumentId];
}

function figureVariables(
  orientation: keyof IdentityLayouts,
  figure: IdentityFigure | undefined,
): Record<string, string> {
  if (!figure) return {};
  const prefix = `--identity-${orientation}-figure`;
  const variables: Record<string, string> = {};
  if (figure.width) variables[`${prefix}-width`] = figure.width;
  if (figure.x) variables[`${prefix}-x`] = figure.x;
  if (figure.y) variables[`${prefix}-y`] = figure.y;
  if (figure.rotation) variables[`${prefix}-rotation`] = figure.rotation;
  if (figure.scale !== undefined) variables[`${prefix}-scale`] = String(figure.scale);
  if (figure.opacity !== undefined) variables[`${prefix}-opacity`] = String(figure.opacity);
  if (figure.mask) variables[`${prefix}-mask`] = figure.mask;
  return variables;
}

function horizontalAnchorPercentage(anchor: ReturnType<typeof identityAnchorEdges>["x"]): number {
  if (anchor === "left") return 0;
  if (anchor === "center") return 50;
  return 100;
}

// `top`/`left` are typed broadly (IdentityOffset also allows clamp()/calc()/
// min()/max(), for future authoring flexibility) but every layout authored
// so far uses a plain percentage. identityAnchorOffset() resolves position
// in JS, against the live projected bounding box, specifically so the
// caption can be placed via a single `transform` instead of layout-
// triggering CSS `top`/`left`/`width`/`height` recomputed every animation
// frame (see OrchestraScene.ts's positionIdentity()) — that only works for
// a value simple enough to parse without asking the browser to lay it out,
// so this fails loudly rather than silently mispositioning a caption if a
// future layout ever uses one of the richer CSS functions the type allows.
function parsePercent(value: string, field: string): number {
  const match = /^(-?\d+(?:\.\d+)?)%$/.exec(value);
  if (!match) {
    throw new Error(`identityAnchorOffset: ${field} must be a plain percentage (e.g. "-20%") to resolve without a layout read, got "${value}"`);
  }
  return Number.parseFloat(match[1]);
}

/** The caption's anchor point and offset, in percent of the projected bounding box, for JS-side (transform-based) positioning. */
export function identityAnchorOffset(
  navigation: NavigationState,
  orientation: keyof IdentityLayouts,
): { anchorX: number; anchorY: number; left: number; top: number } {
  const layout = layoutsFor(navigation)[orientation];
  const edge = identityAnchorEdges(layout.anchor);
  return {
    anchorX: horizontalAnchorPercentage(edge.x),
    anchorY: edge.y === "top" ? 0 : 100,
    left: parsePercent(layout.left, `${orientation}.left`),
    top: parsePercent(layout.top, `${orientation}.top`),
  };
}

export function identityLayoutVariables(
  navigation: NavigationState,
): Record<string, string> {
  const layouts = layoutsFor(navigation);
  const variables: Record<string, string> = {};
  for (const orientation of ["portrait", "landscape"] as const) {
    const layout = layouts[orientation];
    variables[`--identity-${orientation}-size`] = layout.fontSize;
    Object.assign(variables, figureVariables(orientation, layout.figure));
  }
  return variables;
}

export function identityFigures(
  navigation: NavigationState,
): Partial<Record<keyof IdentityLayouts, IdentityFigure>> {
  if (navigation.level === "orchestra") return {};
  const layouts = layoutsFor(navigation);
  const figures: Partial<Record<keyof IdentityLayouts, IdentityFigure>> = {};
  // Resolved here (not in each instrument/family data file) so every
  // consumer — the <img src>, the srcSet small-variant lookup, everything —
  // automatically gets the R2 URL in production without knowing about it.
  if (layouts.portrait.figure) figures.portrait = { ...layouts.portrait.figure, src: mediaUrl(layouts.portrait.figure.src) };
  if (layouts.landscape.figure) figures.landscape = { ...layouts.landscape.figure, src: mediaUrl(layouts.landscape.figure.src) };
  return figures;
}
