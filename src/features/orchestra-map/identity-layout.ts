import { familyIdentityLayouts, orchestraIdentityLayout } from "./identity-layout/families";
import { instrumentIdentityLayouts } from "./identity-layout/instruments";
import type {
  IdentityAnchor,
  IdentityFigure,
  IdentityLayouts,
} from "./identity-layout/types";
import type { NavigationState } from "./utils/navigation";

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

function horizontalAnchorPercentage(anchor: ReturnType<typeof identityAnchorEdges>["x"]) {
  if (anchor === "left") return "0%";
  if (anchor === "center") return "50%";
  return "100%";
}

export function identityLayoutVariables(
  navigation: NavigationState,
): Record<string, string> {
  const layouts = layoutsFor(navigation);
  const variables: Record<string, string> = {};
  for (const orientation of ["portrait", "landscape"] as const) {
    const layout = layouts[orientation];
    variables[`--identity-${orientation}-top`] = layout.top;
    variables[`--identity-${orientation}-left`] = layout.left;
    variables[`--identity-${orientation}-size`] = layout.fontSize;
    Object.assign(variables, figureVariables(orientation, layout.figure));
    const edge = identityAnchorEdges(layout.anchor);
    variables[`--identity-${orientation}-anchor-x`] = horizontalAnchorPercentage(edge.x);
    variables[`--identity-${orientation}-anchor-y`] =
      edge.y === "top" ? "0%" : "100%";
  }
  return variables;
}

export function identityFigures(
  navigation: NavigationState,
): Partial<Record<keyof IdentityLayouts, IdentityFigure>> {
  if (navigation.level === "orchestra") return {};
  const layouts = layoutsFor(navigation);
  const figures: Partial<Record<keyof IdentityLayouts, IdentityFigure>> = {};
  if (layouts.portrait.figure) figures.portrait = layouts.portrait.figure;
  if (layouts.landscape.figure) figures.landscape = layouts.landscape.figure;
  return figures;
}
