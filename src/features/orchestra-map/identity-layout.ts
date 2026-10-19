import { familyIdentityLayouts, orchestraIdentityLayout } from "./identity-layout/families";
import { instrumentIdentityLayouts } from "./identity-layout/instruments";
import type {
  IdentityFigure,
  IdentityLayouts,
} from "./identity-layout/types";
import type { NavigationState } from "./utils/navigation";
import { mediaUrl } from "../../lib/media-url";

export { familyLayout, instrumentLayout } from "./identity-layout/defaults";
export type {
  IdentityFigure,
  IdentityLayout,
  IdentityLayoutOverrides,
  IdentityLayouts,
} from "./identity-layout/types";

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

function figureSize(figure: IdentityFigure): { width: string; height: string } {
  return {
    width: figure.width ?? "auto",
    height: figure.height ?? "auto",
  };
}

function figureVariables(
  orientation: keyof IdentityLayouts,
  figure: IdentityFigure | undefined,
): Record<string, string> {
  if (!figure) return {};
  const prefix = `--identity-${orientation}-figure`;
  const variables: Record<string, string> = {};
  const size = figureSize(figure);
  variables[`${prefix}-width`] = size.width;
  variables[`${prefix}-height`] = size.height;
  if (figure.x) variables[`${prefix}-x`] = figure.x;
  if (figure.y) variables[`${prefix}-y`] = figure.y;
  if (figure.rotation) variables[`${prefix}-rotation`] = figure.rotation;
  if (figure.scale !== undefined) variables[`${prefix}-scale`] = String(figure.scale);
  if (figure.opacity !== undefined) variables[`${prefix}-opacity`] = String(figure.opacity);
  if (figure.mask) variables[`${prefix}-mask`] = figure.mask;
  return variables;
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
  if (layouts.portrait.figure) figures.portrait = { ...layouts.portrait.figure, ...figureSize(layouts.portrait.figure), src: mediaUrl(layouts.portrait.figure.src) };
  if (layouts.landscape.figure) figures.landscape = { ...layouts.landscape.figure, ...figureSize(layouts.landscape.figure), src: mediaUrl(layouts.landscape.figure.src) };
  return figures;
}

/** All caption levels share edge/alignment placement. */
export function identityCaptionPlacement(navigation: NavigationState, orientation: keyof IdentityLayouts) {
  const layouts = layoutsFor(navigation)
  const layout = layouts[orientation]
  return { edge: layout.edge ?? 'top', align: layout.align ?? 'center', gap: layout.gap ?? 2, side: layout.side ?? 'outside' }
}
