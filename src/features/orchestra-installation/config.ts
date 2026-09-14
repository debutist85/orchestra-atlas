export const seatingPresetNames = [
  "compact",
  "classical-wide",
  "installation-spread",
] as const;
export type SeatingPresetName = (typeof seatingPresetNames)[number];

export type OrchestraFamily =
  | "strings"
  | "woodwinds"
  | "brass"
  | "percussion"
  | "auxiliary";
export type OrchestraInstrument =
  | "violin1"
  | "violin2"
  | "viola"
  | "cello"
  | "doubleBass"
  | "flute"
  | "oboe"
  | "clarinet"
  | "bassoon"
  | "horn"
  | "trumpet"
  | "trombone"
  | "tuba"
  | "percussion"
  | "timpani"
  | "harp"
  | "piano";
export type OrchestraSectionId =
  | "strings"
  | "woodwinds"
  | "brass"
  | "percussion"
  | "keyboard-instruments"
  | "plucked-instruments"
  | "conductor"
  | "grid";

export type SectionWedge = {
  id: string;
  sectionId: OrchestraSectionId;
  stringInstrument?: "violin1" | "violin2" | "viola" | "cello" | "doubleBass";
  startAngle: number;
  endAngle: number;
  rings: number[]; // Zero-based shared ring indices; counts come from seating data.
  singletonColumn?: number; // 0 = start, 1 = end, default = center.
};

export type OrchestraSceneConfig = {
  visuals: OrchestraVisualSettings;
  orchestraScale: number;
  conductorOrigin: [number, number, number];
  surfaceWarp: { height: number };
  showNodeNumbers: boolean;
  showConductor: boolean;
  hiddenNodeIds: string[]; // Stable IDs, e.g. 'grid-r0-s0'; removal from this list restores a node.
  nodeSections: Partial<Record<string, OrchestraSectionId>>; // Semantic overrides by stable grid ID.
  defaultNodeSection: OrchestraSectionId;
  nodeSizeMultipliers: Partial<Record<string, number>>; // Radius/diameter scale; never changes the node center.
  polarGrid: {
    innerRadius: number;
    ringCount: number;
    radialSpacing: number;
    fanStartAngle: number;
    fanEndAngle: number;
    spokeCount: number;
    nodeRadius: number;
    monochromeGrid: boolean;
    showGuides: boolean; // Only visible in development debug mode.
  };
  // Inactive historical wedge experiment; the polar grid does not consume this.
  composition: {
    rings: { radius: number; angularRange: [number, number] }[]; // Degrees from centerline.
    wedges: SectionWedge[];
    targetPlayerSpacing: number; // Soft review reference; wedge boundaries/counts determine actual intervals.
    angularJitter: number; // Tangential displacement, canonical units.
    showRingGuides: boolean;
    playerScale: "uniform" | "subtle" | "original";
    playerRadius: number;
    subtleVariation: number; // Blend from uniform radius toward authored sizes.
  };
  gyroscope: {
    enabled: boolean;
    maxTiltDegrees: number;
    easing: number;
  };
  sections: Record<
    OrchestraSectionId,
    {
      name: string;
      family: OrchestraFamily;
      color: string;
      gradient?: [string, string, string]; // Left to right, with a gentle elevation bias.
    }
  >;
  camera: {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
    desktopOccupancy: number; // Fraction of the upper-half framing area occupied by the formation.
  };
};

// Art direction only. Per-section interaction values live in visual-state.ts.
// These settings are staged for the upcoming material/floor implementation.
export type OrchestraVisualSettings = {
  performance: {
    maxPixelRatio: number;
    maxRenderPixels: number;
    frameRate: number;
    antialias: boolean;
    antialiasSamples: number;
  };
  exposure: number; // Tone-mapping exposure; bloom uses the original HDR brightness.
  nodes: {
    ghost: {
      enabled: boolean;
      intervalSeconds: number;
      durationSeconds: number;
      opacity: number;
      offset: number;
    };
    idle: {
      enabled: boolean;
      periodSeconds: number; // Gradient drift period.
      gradientShift: number;
      pulsePeriodSeconds: number; // Luminosity/glow pulse; geometry stays fixed.
      brightnessVariation: number; // Fractional pulse amplitude around neutral brightness.
    };
    shape: "sphere" | "disk";
    diskThickness: number; // Thickness as a fraction of the node radius.
    emissiveIntensity: number;
    roughness: number;
    internalShadow: number; // 0–1 directional shading of the luminous interior.
    palette: {
      hueVariationDegrees: number;
      brightnessVariation: number; // Fractional variation around the base brightness.
    };
  };
  glow: {
    enabled: boolean;
    strength: number;
    radius: number;
    threshold: number;
  };
  floor: {
    enabled: boolean;
    color: string;
    clearance: number; // World units below the lowest sphere, before preset scaling.
    roughness: number;
    stageGlow: {
      enabled: boolean;
      color: string; // Lit floor tone at the center of the installation.
      radius: number; // Canonical world units, side-to-side spread.
      depthRadius: number; // Canonical world units, toward/away-from-camera spread.
      offset: number; // Canonical world units to shift the bright spot toward the viewer.
      intensity: number; // 0–1 blend toward `color` at the peak.
    };
    reflections: {
      enabled: boolean;
      mode: "original" | "softened";
      strength: number;
      blur: number;
      resolution: number;
      distance: number; // Canonical floor distance before softened reflections disappear.
    };
    shadows: { enabled: boolean; opacity: number; softness: number };
    lightSpill: { enabled: boolean; strength: number; radiusScale: number }; // Broad ambient wash.
    localPools: {
      enabled: boolean;
      intensity: number;
      radius: number; // Canonical world units, independent of player height.
      softness: number; // 0–1 feather width.
      density: number; // Fraction of players contributing, selected by stable ID.
      groundOffset: number; // Height above the stage, before preset scaling.
      stretch: number; // Depth-axis elongation, simulating a reflection falling toward the viewer.
    };
  };
  interaction: {
    transitionSeconds: number;
    neutralIntensity: number; // Baseline brightness; reserve HDR headroom for highlighting.
    dimmedIntensity: number; // Intensity multiplier at emphasis -1.
    highlightedIntensity: number; // Intensity multiplier at emphasis +1.
  };
};

const baseline: OrchestraSceneConfig = {
  visuals: {
    performance: {
      maxPixelRatio: 1.5,
      maxRenderPixels: 3000000,
      frameRate: 30,
      antialias: true,
      antialiasSamples: 4,
    },
    exposure: 1,
    nodes: {
      ghost: {
        enabled: true,
        intervalSeconds: 18,
        durationSeconds: 3.5,
        opacity: 0.12,
        offset: 1.1,
      },
      idle: {
        enabled: false,
        periodSeconds: 16,
        gradientShift: 0,
        pulsePeriodSeconds: 6,
        brightnessVariation: 0,
      },
      shape: "disk",
      diskThickness: 0.12,
      emissiveIntensity: 1.2,
      roughness: 0.55,
      internalShadow: 0.95,
      palette: { hueVariationDegrees: 8, brightnessVariation: 0.12 },
    },
    glow: { enabled: true, strength: 0.3, radius: 0.4, threshold: 0.65 },
    floor: {
      enabled: true,
      color: "#101216",
      clearance: 0.15,
      roughness: 0.2,
      stageGlow: {
        enabled: true,
        color: "#4a453c",
        radius: 9,
        depthRadius: 4.5,
        offset: 2,
        intensity: 0.55,
      },
      reflections: {
        enabled: false,
        mode: "softened",
        strength: 0.35,
        blur: 1.2,
        resolution: 512,
        distance: 1.2,
      },
      shadows: { enabled: true, opacity: 0.25, softness: 0.7 },
      lightSpill: { enabled: false, strength: 0.15, radiusScale: 3 },
      localPools: {
        enabled: false,
        intensity: 0.55,
        radius: 0.6,
        softness: 0.75,
        density: 0.35,
        groundOffset: 0.004,
        stretch: 3,
      },
    },
    interaction: {
      transitionSeconds: 0.3,
      neutralIntensity: 0.4,
      dimmedIntensity: 0.12,
      highlightedIntensity: 1,
    },
  },
  orchestraScale: 1,
  conductorOrigin: [0, 0, 0],
  // Front/back curvature of the upright fan; 0 removes the radial warp.
  surfaceWarp: { height: -1 },
  showNodeNumbers: false,
  showConductor: true,
  hiddenNodeIds: [
    "grid-r0-s1",
    "grid-r0-s3",
    "grid-r0-s5",
    "grid-r0-s7",
    "grid-r0-s9",
    "grid-r0-s11", // Nodes 2, 4, 6, 8, 10, 12.
    "grid-r3-s4",
    "grid-r3-s8",
    "grid-r4-s0",
    "grid-r4-s3",
    "grid-r4-s7",
    "grid-r4-s11",
    "grid-r4-s12", // Nodes 44, 48, 53, 56, 60, 64, 65.
  ],
  defaultNodeSection: "strings",
  nodeSizeMultipliers: {
    "grid-r4-s1": 1.5,
    "grid-r4-s2": 1.5, // 54-55.
    "grid-r4-s4": 1.5,
    "grid-r4-s5": 1.5,
    "grid-r4-s6": 1.5, // 57-59.
    "grid-r4-s8": 1.2,
    "grid-r4-s9": 1.2,
    "grid-r4-s10": 1.2, // 61-63.
    "grid-r3-s10": 1.5,
    "grid-r3-s11": 1.5,
    "grid-r3-s12": 1.5, // 50–52.
    "grid-r3-s5": 1.2,
    "grid-r3-s6": 1.2,
    "grid-r3-s7": 1.2, // 45–47.
    "grid-r0-s10": 1.2,
    "grid-r0-s12": 1.2, // 11, 13.
    "grid-r1-s10": 1.2,
    "grid-r1-s11": 1.2,
    "grid-r1-s12": 1.2, // 24–26.
    "grid-r2-s10": 1.2,
    "grid-r2-s11": 1.2,
    "grid-r2-s12": 1.2, // 37–39.
    "grid-r0-s0": 0.8,
    "grid-r0-s2": 0.8,
    "grid-r0-s4": 0.8, // 1, 3, 5.
    "grid-r1-s0": 0.8,
    "grid-r1-s1": 0.8,
    "grid-r1-s2": 0.8,
    "grid-r1-s3": 0.8,
    "grid-r1-s4": 0.8, // 14–18.
    "grid-r2-s0": 0.8,
    "grid-r2-s1": 0.8,
    "grid-r2-s2": 0.8,
    "grid-r2-s3": 0.8, // 27–30.
    "grid-r3-s0": 0.8,
    "grid-r3-s1": 0.8,
    "grid-r3-s2": 0.8,
    "grid-r3-s3": 0.8, // 40–43.
  },
  nodeSections: {
    // Woodwinds: 19–21, 31–35.
    "grid-r1-s5": "woodwinds",
    "grid-r1-s6": "woodwinds",
    "grid-r1-s7": "woodwinds",
    "grid-r2-s4": "woodwinds",
    "grid-r2-s5": "woodwinds",
    "grid-r2-s6": "woodwinds",
    "grid-r2-s7": "woodwinds",
    "grid-r2-s8": "woodwinds",
    // Brass: 45–47, 61–63.
    "grid-r3-s5": "brass",
    "grid-r3-s6": "brass",
    "grid-r3-s7": "brass",
    "grid-r4-s8": "brass",
    "grid-r4-s9": "brass",
    "grid-r4-s10": "brass",
    // Percussion: 57–59. Keyboard: 54. Plucked: 55.
    "grid-r4-s4": "percussion",
    "grid-r4-s5": "percussion",
    "grid-r4-s6": "percussion",
    "grid-r4-s1": "keyboard-instruments",
    "grid-r4-s2": "plucked-instruments",
  },
  polarGrid: {
    innerRadius: 2.7,
    ringCount: 5,
    radialSpacing: 1.128,
    fanStartAngle: -77.1,
    fanEndAngle: 77.1,
    spokeCount: 13,
    nodeRadius: 0.24,
    monochromeGrid: false,
    showGuides: true,
  },
  composition: {
    rings: [
      { radius: 2.7, angularRange: [-77.1, 77.1] },
      { radius: 3.828, angularRange: [-77.1, 77.1] },
      { radius: 4.956, angularRange: [-77.1, 77.1] },
      { radius: 6.084, angularRange: [-77.1, 77.1] },
      { radius: 7.212, angularRange: [-62, 37] },
    ],
    wedges: [
      {
        id: "violin1",
        sectionId: "strings",
        stringInstrument: "violin1",
        startAngle: -77.1,
        endAngle: -48,
        rings: [0, 1, 2, 3],
      },
      {
        id: "violin2",
        sectionId: "strings",
        stringInstrument: "violin2",
        startAngle: -36,
        endAngle: -18,
        rings: [0, 1, 2, 3],
        singletonColumn: 0,
      },
      {
        id: "viola",
        sectionId: "strings",
        stringInstrument: "viola",
        startAngle: 18,
        endAngle: 36,
        rings: [0, 1, 2, 3],
        singletonColumn: 1,
      },
      {
        id: "cello",
        sectionId: "strings",
        stringInstrument: "cello",
        startAngle: 48,
        endAngle: 77.1,
        rings: [0, 1, 2],
      },
      {
        id: "doubleBass",
        sectionId: "strings",
        stringInstrument: "doubleBass",
        startAngle: 48,
        endAngle: 77.1,
        rings: [3],
      },
      {
        id: "woodwinds",
        sectionId: "woodwinds",
        startAngle: -11,
        endAngle: 11,
        rings: [1, 2],
      },
      {
        id: "brass-center",
        sectionId: "brass",
        startAngle: -10,
        endAngle: 10,
        rings: [3],
      },
      {
        id: "brass-rear",
        sectionId: "brass",
        startAngle: 17,
        endAngle: 37,
        rings: [4],
      },
      {
        id: "percussion",
        sectionId: "percussion",
        startAngle: -38,
        endAngle: 2,
        rings: [4],
      },
      {
        id: "keyboard",
        sectionId: "keyboard-instruments",
        startAngle: -65,
        endAngle: -59,
        rings: [4],
      },
      {
        id: "plucked",
        sectionId: "plucked-instruments",
        startAngle: -55,
        endAngle: -49,
        rings: [4],
      },
    ],
    targetPlayerSpacing: 1.1,
    angularJitter: 0.015,
    showRingGuides: true,
    playerScale: "uniform",
    playerRadius: 0.24,
    subtleVariation: 0.35,
  },
  gyroscope: { enabled: false, maxTiltDegrees: 3, easing: 0.08 },
  sections: {
    grid: { name: "Polar grid", family: "auxiliary", color: "#bac3cd" },
    /*     strings: { name: 'Strings', family: 'strings', color: '#e85870', gradient: ['#ff781f', '#a60932', '#ff528a'] }, */
    /* strings: {
      name: "Strings",
      family: "strings",
      color: "#F75A71",
      gradient: ["#F9AB8F", "#F75A71", "#F40752"],
    }, */
    strings: {
      name: "Strings",
      family: "strings",
      color: "#FC5552",
      gradient: ["#f0772f", "#F75A71", "#FF0F7B"],
    },
    /*  woodwinds: {
      name: "Woodwinds",
      family: "woodwinds",
      color: "#429dcc",
      gradient: ["#23bad9", "#1652a3", "#6692f0"],
    }, */
    woodwinds: {
      name: "Woodwinds",
      family: "woodwinds",
      color: "#376BC9",
      gradient: ["#4DC9E6", "#376BC9", "#08203e"],
    },
    /* brass: {
      name: "Brass",
      family: "brass",
      color: "#d9b65d",
      gradient: ["#e18b27", "#e9b744", "#ffe49b"],
    }, */
    brass: {
      name: "Brass",
      family: "brass",
      color: "#F0AE3B",
      gradient: ["#F4D941", "#F0AE3B", "#EC8235"],
    },
    percussion: {
      name: "Percussion",
      family: "percussion",
      color: "#a887c4",
      gradient: ["#78509e", "#a76bbb", "#df9cbc"],
    },
    "keyboard-instruments": {
      name: "Keyboard instruments",
      family: "auxiliary",
      color: "#2cb2ba",
    },
    "plucked-instruments": {
      name: "Plucked instruments",
      family: "auxiliary",
      color: "#e65763",
    },
    conductor: { name: "Conductor", family: "auxiliary", color: "#ffffff" },
  },
  camera: {
    position: [0, 6, 30],
    target: [0, 0, 0],
    fov: 24,
    desktopOccupancy: 0.85,
  },
};

export const orchestraScenePresets: Record<
  SeatingPresetName,
  OrchestraSceneConfig
> = {
  compact: { ...baseline, orchestraScale: 0.9 },
  "classical-wide": baseline,
  "installation-spread": { ...baseline, orchestraScale: 1.08 },
};

export const defaultSeatingPreset: SeatingPresetName = "classical-wide";

export function isSeatingPresetName(
  value: string | null,
): value is SeatingPresetName {
  return seatingPresetNames.some((name) => name === value);
}
