import type { IdentityLayoutOverrides, IdentityLayouts } from "./types";

// Each call creates independent values: editing one subject never changes another.
export function familyLayout(
  overrides: IdentityLayoutOverrides = {},
): IdentityLayouts {
  return {
    landscape: {
      edge: "top",
      align: "center",
      side: "outside",
      gap: 2,
      fontSize: "clamp(54px, 4vw, 200px)",
      ...overrides.landscape,
    },
    portrait: {
      edge: "top",
      align: "center",
      side: "outside",
      gap: 2,
      fontSize: "clamp(62px, 12vw, 130px)",
      ...overrides.portrait,
    },
  };
}

export function instrumentLayout(
  overrides: IdentityLayoutOverrides = {},
): IdentityLayouts {
  return {
    landscape: {
      edge: "top",
      align: "center",
      side: "outside",
      gap: 0,
      fontSize: "clamp(76px, 15vmin, 100px)",
      ...overrides.landscape,
    },
    portrait: {
      edge: "top",
      align: "center",
      side: "outside",
      gap: 2,
      fontSize: "clamp(76px, 23vmin, 100px)",
      ...overrides.portrait,
    },
  };
}
