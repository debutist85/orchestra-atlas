import type { OrchestraInstrument } from "./config";
import type { FamilyId, NavigationState } from "./utils/navigation";

export type IdentityAnchor =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type IdentityLayout = {
  /** Percent of the selected box height, added to its anchor (positive moves down). */
  top: `${number}%`;
  /** Percent of the selected box width, added to its anchor (positive moves right). */
  left: `${number}%`;
  /** Any CSS font-size value, including clamp(), min(), vw and vh. */
  fontSize: string;
  /** A point on the selected constellation’s projected bounding box. */
  anchor: IdentityAnchor;
};
export type IdentityLayouts = Record<"portrait" | "landscape", IdentityLayout>;

export function identityAnchorEdges(anchor: IdentityAnchor) {
  const [vertical, horizontal] = anchor.split("-") as [
    "top" | "bottom",
    "left" | "center" | "right",
  ];
  return { x: horizontal, y: vertical };
}

/** Override any setting independently for either orientation. */
export type IdentityLayoutOverrides = Partial<
  Record<keyof IdentityLayouts, Partial<IdentityLayout>>
>;

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
    portrait: {
      top: "-25%",
      left: "0%",
      fontSize: "clamp(76px, 25vw, 140px)",
      anchor: "top-left",
      ...overrides.portrait,
    },
    landscape: {
      top: "-30%",
      left: "0%",
      fontSize: "clamp(64px, 13vw, min(210px, 29vh))",
      anchor: "top-left",
      ...overrides.landscape,
    },
  };
}

/** Stage typography only; no navigation state, camera, or geometry settings. */
export const identityLayouts: {
  orchestra: IdentityLayouts;
  families: Record<FamilyId, IdentityLayouts>;
  instruments: Record<OrchestraInstrument, IdentityLayouts>;
} = {
  orchestra: familyLayout({
    landscape: {
      top: "0%",
      left: "0%",
      anchor: "top-left",
      fontSize: "clamp(12px, 4vw, 90px)",
    },
    portrait: {
      top: "-80%",
      left: "0%",
      anchor: "top-center",
    },
  }),
  families: {
    strings: familyLayout({
      landscape: {
        top: "-10%",
        left: "0%",
        anchor: "bottom-center",
        fontSize: "clamp(44px, 5vw, 90px)",
      },
      portrait: {
        top: "50%",
        left: "0%",
        anchor: "bottom-center",
        fontSize: "clamp(62px, 12vw, 130px)",
      },
    }),
    woodwinds: familyLayout({
      landscape: {
        top: "-10%",
        left: "-20%",
        anchor: "top-right",
        fontSize: "clamp(44px, 5vw, 90px)",
      },
      portrait: {
        top: "-100%",
        left: "0%",
        anchor: "top-center",
        fontSize: "clamp(64px, 8vw, 100px)",
      },
    }),
    brass: familyLayout({
      landscape: {
        top: "-30%",
        left: "0%",
        anchor: "bottom-center",
        fontSize: "clamp(74px, 8vw, 100px)",
      },
      portrait: {
        top: "-150%",
        left: "10%",
        anchor: "bottom-center",
        fontSize: "clamp(74px, 8vw, 100px)",
      },
    }),
    percussion: familyLayout({
      landscape: {
        top: "-40%",
        left: "-10%",
        anchor: "top-center",
      },
      portrait: {
        top: "-100%",
        left: "0%",
        anchor: "top-center",
        fontSize: "clamp(54px, 6vw, 100px)",
      },
    }),
    other: familyLayout({
      landscape: {
        top: "30%",
        left: "-30%",
        anchor: "top-left",
      },
      portrait: {
        top: "-80%",
        left: "-10%",
        anchor: "top-center",
      },
    }),
  },
  instruments: {
    violin: instrumentLayout({
      landscape: {
        top: "20%",
        left: "0%",
        anchor: "top-center",
      },
      portrait: {
        top: "-30%",
        left: "10%",
        anchor: "top-center",
      },
    }),
    violin1: instrumentLayout(),
    violin2: instrumentLayout(),
    viola: instrumentLayout({
      landscape: {
        top: "20%",
        left: "0%",
        anchor: "top-center",
      },
      portrait: {
        top: "-30%",
        left: "-15%",
        anchor: "top-center",
      },
    }),
    cello: instrumentLayout(
      {
        landscape: {
          top: "20%",
          left: "0%",
          anchor: "top-center",
        },
        portrait: {
          top: "-40%",
          left: "-15%",
          anchor: "top-center",
        },
      }
    ),
    doubleBass: instrumentLayout({
      landscape: {
        top: "20%",
        left: "0%",
        anchor: "top-center",
      },
      portrait: {
        top: "-30%",
        left: "0%",
        anchor: "top-center",
        fontSize: "clamp(74px, 8vw, 100px)",
      },
    }
  ),
    flute: instrumentLayout(),
    oboe: instrumentLayout(),
    clarinet: instrumentLayout({
      landscape: {
        top: "20%",
        left: "0%",
        anchor: "top-center",
      },
      portrait: {
        top: "-170%",
        left: "0%",
        anchor: "top-center",
      },
    }),
    bassoon: instrumentLayout(
      {
        landscape: {
          top: "20%",
          left: "0%",
          anchor: "top-center",
        },
        portrait: {
          top: "-120%",
          left: "0%",
          anchor: "top-center",
        },
      }
    ),
    horn: instrumentLayout({
      landscape: {
        top: "20%",
        left: "0%",
        anchor: "bottom-center",
        fontSize: "clamp(54px, 10vw, 90px)",
      },
      portrait: {
        top: "100%",
        left: "0%",
        anchor: "bottom-center",
        fontSize: "clamp(74px, 12vw, 90px)",
      },
    }),
    trumpet: instrumentLayout({
      landscape: {
        top: "-20%",
        left: "-10%",
        anchor: "top-center",
        fontSize: "clamp(54px, 9vw, 90px)",
      },
      portrait: {
        top: "-100%",
        left: "-90%",
        anchor: "top-right",
        fontSize: "clamp(54px, 8vw, 90px)",
      },
    }),
    trombone: instrumentLayout({
      landscape: {
        top: "20%",
        left: "0%",
        anchor: "top-center",
        fontSize: "clamp(54px, 9vw, 90px)",
      },
      portrait: {
        top: "-70%",
        left: "-100%",
        anchor: "top-right",
        fontSize: "clamp(54px, 8vw, 90px)",
      },
    }),
    tuba: instrumentLayout({
      landscape: {
        top: "20%",
        left: "30%",
        anchor: "top-right",
        fontSize: "clamp(54px, 10vw, 90px)",
      },
      portrait: {
        top: "50%",
        left: "-35%",
        anchor: "bottom-center",
        fontSize: "clamp(74px, 12vw, 90px)",
      },
    }),
    percussion: instrumentLayout(),
    timpani: instrumentLayout(),
    pitchedPercussion: instrumentLayout({
      portrait: { fontSize: "clamp(42px, 12vw, 68px)" },
    }),
    unpitchedPercussion: instrumentLayout({
      portrait: { fontSize: "clamp(42px, 12vw, 68px)" },
    }),
    harp: instrumentLayout(),
    piano: instrumentLayout(),
    keyboard: instrumentLayout(),
    celesta: instrumentLayout(),
  },
};

export function identityLayoutVariables(
  navigation: NavigationState,
): Record<string, string> {
  const layouts =
    navigation.level === "orchestra"
      ? identityLayouts.orchestra
      : navigation.level === "family"
        ? identityLayouts.families[navigation.familyId]
        : identityLayouts.instruments[navigation.instrumentId];
  const variables: Record<string, string> = {};
  for (const orientation of ["portrait", "landscape"] as const) {
    const layout = layouts[orientation];
    variables[`--identity-${orientation}-top`] = layout.top;
    variables[`--identity-${orientation}-left`] = layout.left;
    variables[`--identity-${orientation}-size`] = layout.fontSize;
    const edge = identityAnchorEdges(layout.anchor);
    variables[`--identity-${orientation}-anchor-x`] =
      edge.x === "left" ? "0%" : edge.x === "center" ? "50%" : "100%";
    variables[`--identity-${orientation}-anchor-y`] =
      edge.y === "top" ? "0%" : "100%";
  }
  return variables;
}
