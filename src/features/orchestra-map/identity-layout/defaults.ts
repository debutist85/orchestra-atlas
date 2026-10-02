import type { IdentityLayoutOverrides, IdentityLayouts } from "./types";

// Each call creates independent values: editing one subject never changes another.
export function familyLayout(
  overrides: IdentityLayoutOverrides = {},
): IdentityLayouts {
  return {
    portrait: {
      top: "-25%",
      left: "0%",
      fontSize: "clamp(62px, 12vw, 130px)",
      anchor: "top-left",
      ...overrides.portrait,
    },
    landscape: {
      top: "-30%",
      left: "0%",
      fontSize: "clamp(54px, 6vw, min(180px, 29vh))",
      anchor: "top-left",
      ...overrides.landscape,
    },
  };
}

export function instrumentLayout(
  overrides: IdentityLayoutOverrides = {},
): IdentityLayouts {
  return {
    landscape: {
      top: "0%",
      left: "0%",
      fontSize: "clamp(76px, 15vmin, 100px)",
      anchor: "top-left",
      ...overrides.landscape,
    },
    portrait: {
      top: "0%",
      left: "0%",
      fontSize: "clamp(76px, 23vmin, 100px)",
      anchor: "top-left",
      ...overrides.portrait,
    }
  };
}
