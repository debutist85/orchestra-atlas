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
  | "violin"
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
  | "pitchedPercussion"
  | "unpitchedPercussion"
  | "harp"
  | "piano"
  | "keyboard"
  | "celesta";
export type OrchestraSectionId =
  | "strings"
  | "woodwinds"
  | "brass"
  | "percussion"
  | "keyboard-instruments"
  | "plucked-instruments"
  | "conductor"
  | "grid";

export type OrchestraSceneConfig = {
  visuals: OrchestraVisualSettings;
  orchestraScale: number;
  conductorOrigin: [number, number, number];
  showNodeNumbers: boolean;
  showConductor: boolean;
  hiddenNodeIds: string[]; // Stable IDs, e.g. 'grid-r0-s0'; removal from this list restores a node.
  nodeSections: Partial<Record<string, OrchestraSectionId>>; // Semantic overrides by stable grid ID.
  defaultNodeSection: OrchestraSectionId;
  instrumentGroups: Partial<Record<OrchestraSectionId, {
    instrument: OrchestraInstrument;
    name: string;
    nodeIds: string[];
    color?: string; // Solid hue; neighboring groups form the family wash.
    colorBands?: { id: string; color: string; nodeIds: string[] }[]; // Extra hues inside one instrument.
  }[]>>;
  sectionHoverRegions: {
    enabled: boolean;
    padding: number; // World-space expansion beyond the referenced boundary nodes.
    regions: {
      sectionId: OrchestraSectionId;
      boundaryNodeIds: string[]; // Ordered polygon; one/two nodes create a circular/capsule region.
      padding?: number;
    }[];
  };
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
  sections: Record<
    OrchestraSectionId,
    {
      name: string;
      family: OrchestraFamily;
      color: string;
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
      familyOpacity: number;
      familyDurationSeconds: number;
      familyOffset: number;
      selectedOpacity: number;
      selectedDurationSeconds: number;
      selectedOffset: number;
    };
    idle: {
      enabled: boolean;
      pulsePeriodSeconds: number; // Luminosity/glow pulse; geometry stays fixed.
      brightnessVariation: number; // Fractional pulse amplitude around neutral brightness.
    };
    // A rim/outline that lights up while an instrument is genuinely audible in
    // the recording (derived from real audio content), independent of zoom
    // and navigation dimming — distinct from the ghost wave and node color.
    audioHighlight: {
      enabled: boolean;
      color: string;
      offsetScale: number; // Outline shell radius as a multiple of the node radius.
      opacity: number; // Peak rim opacity at full audible activity.
      easingRate: number; // Exponential blend rate (per second) toward the current activity.
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
    hoverTransitionSeconds: number;
    neutralIntensity: number; // Baseline brightness; reserve HDR headroom for highlighting.
    familyIntensity: number; // Persistent family selection, leaving headroom for instruments.
    instrumentHoveredIntensity: number; // Transient emphasis within the selected family.
    hoveredIntensity: number; // Transient pointer emphasis, below a highlighted section.
    dimmedIntensity: number; // Intensity multiplier at emphasis -1.
    highlightedIntensity: number; // Intensity multiplier at emphasis +1.
  };
    // Ambient appearance only. Does not move seating, labels, or the camera.
    idleAnimation: {
    enabled: boolean;
    brightnessMin: number;
    brightnessMax: number;
    durationMin: number;
    durationMax: number;
    scaleAmount: number;
    glintEnabled: boolean;
    glintIntervalMin: number;
    glintIntervalMax: number;
    glintIntensity: number;
    glintDuration: number;
    glintClusterMin: number;
    glintClusterMax: number;
    glintStagger: number;
    reflectionResponse: number;
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
        // T (intervalSeconds) is shared across every level and must never
        // differ per zoom depth — see the vertex shader comment in
        // node-ghost.ts for why. Idle's longer durationSeconds only makes
        // each pulse linger longer against that same unchanged clock, for a
        // slower, more sustained ambient feel while zoomed all the way out.
        intervalSeconds: 0.85,
        durationSeconds: 2.3,
        opacity: 0.12,
        offset: 0.85,
        familyOpacity: 0.22,
        familyDurationSeconds: 1.9,
        familyOffset: 1.05,
        selectedOpacity: 0.28,
        selectedDurationSeconds: 1.9,
        selectedOffset: 1.15,
      },
      idle: {
        enabled: false,
        pulsePeriodSeconds: 6,
        brightnessVariation: 0,
      },
      audioHighlight: {
        enabled: true,
        color: "#ffffff",
        offsetScale: 1.38,
        opacity: 1,
        easingRate: 8,
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
      transitionSeconds: 0.7,
      hoverTransitionSeconds: 0.06,
      neutralIntensity: 0.36,
      hoveredIntensity: 0.43,
      familyIntensity: 0.46,
      instrumentHoveredIntensity: 0.72,
      dimmedIntensity: 0.035,
      highlightedIntensity: 1,
    },
    idleAnimation: {
      enabled: false,
      brightnessMin: 0.84,
      brightnessMax: 1.06,
      durationMin: 8,
      durationMax: 14,
      scaleAmount: 0.008,
      glintEnabled: true,
      glintIntervalMin: 6,
      glintIntervalMax: 11,
      glintIntensity: 0.38,
      glintDuration: 4,
      glintClusterMin: 5,
      glintClusterMax: 8,
      glintStagger: 0.7,
      reflectionResponse: 0.25,
    },
  },
  orchestraScale: 1,
  conductorOrigin: [0, 0, 0],
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
    "grid-r4-s12", // Nodes 44, 48, 53, 56, 65.
  ],
  defaultNodeSection: "strings",
  sectionHoverRegions: {
    enabled: true,
    padding: 0.52,
    regions: [
      // Smaller/specific regions come first so overlaps resolve predictably.
      { sectionId: "keyboard-instruments", boundaryNodeIds: ["grid-r4-s1"], padding: 0.66 }, // 54.
      { sectionId: "plucked-instruments", boundaryNodeIds: ["grid-r4-s2"], padding: 0.66 }, // 55.
      { sectionId: "percussion", boundaryNodeIds: ["grid-r4-s4", "grid-r4-s6"] }, // 57–59.
      { sectionId: "woodwinds", boundaryNodeIds: [
        "grid-r1-s5", "grid-r1-s8", "grid-r2-s8", "grid-r2-s5",
      ] }, // 19–22 and 32–35.
      { sectionId: "brass", boundaryNodeIds: [
        "grid-r3-s5", "grid-r3-s7", "grid-r4-s11", "grid-r4-s7",
      ] }, // 45–47 and 60–64.
      { sectionId: "strings", boundaryNodeIds: [
        "grid-r0-s0", "grid-r0-s4", "grid-r2-s4", "grid-r3-s3", "grid-r3-s0",
      ] }, // Violin area.
      { sectionId: "strings", boundaryNodeIds: [
        "grid-r0-s6", "grid-r0-s8", "grid-r1-s9", "grid-r3-s9", "grid-r2-s9",
      ] }, // Viola area.
      { sectionId: "strings", boundaryNodeIds: [
        "grid-r0-s10", "grid-r0-s12", "grid-r2-s12", "grid-r2-s10", "grid-r1-s10",
      ] }, // Cello area.
      { sectionId: "strings", boundaryNodeIds: ["grid-r3-s10", "grid-r3-s12"], padding: 0.7 }, // Double-basses.
    ],
  },
  instrumentGroups: {
    "keyboard-instruments": [{
      instrument: "celesta",
      name: "Celesta",
      color: "#2cb2ba",
      nodeIds: ["grid-r4-s1"], // 54, e.g. piano or celesta.
    }],
    "plucked-instruments": [{
      instrument: "harp",
      name: "Harp",
      color: "#e65763",
      nodeIds: ["grid-r4-s2"], // 55.
    }],
    percussion: [{
      instrument: "pitchedPercussion",
      name: "Pitched percussion",
      color: "#78509e",
      nodeIds: ["grid-r4-s4"], // 57, e.g. xylophone.
    }, {
      instrument: "unpitchedPercussion",
      name: "Unpitched percussion",
      color: "#a76bbb",
      nodeIds: ["grid-r4-s5"], // 58, e.g. tam-tam.
    }, {
      instrument: "timpani",
      name: "Timpani",
      color: "#df9cbc",
      nodeIds: ["grid-r4-s6"], // 59.
    }],
    woodwinds: [{
      instrument: "flute",
      name: "Flute",
      color: "#2FD8E8",
      nodeIds: ["grid-r1-s5", "grid-r1-s6"], // 19, 20.
    }, {
      instrument: "oboe",
      name: "Oboe",
      color: "#4A7FD6",
      nodeIds: ["grid-r1-s7", "grid-r1-s8"], // 21, 22.
    }, {
      instrument: "clarinet",
      name: "Clarinet",
      color: "#376BC9",
      nodeIds: ["grid-r2-s5", "grid-r2-s6"], // 32, 33.
    }, {
      instrument: "bassoon",
      name: "Bassoon",
      color: "#5B45C8",
      nodeIds: ["grid-r2-s7", "grid-r2-s8"], // 34, 35.
    }],
    brass: [{
      instrument: "horn",
      name: "Horn",
      color: "#F4D941",
      nodeIds: ["grid-r3-s5", "grid-r3-s6", "grid-r3-s7"], // 45–47.
    }, {
      instrument: "trumpet",
      name: "Trumpet",
      color: "#F0AE3B",
      nodeIds: ["grid-r4-s7", "grid-r4-s8"], // 60, 61.
    }, {
      instrument: "trombone",
      name: "Trombone",
      color: "#EC8235",
      nodeIds: ["grid-r4-s9", "grid-r4-s10"], // 62, 63.
    }, {
      instrument: "tuba",
      name: "Tuba",
      color: "#E06028",
      nodeIds: ["grid-r4-s11"], // 64.
    }],
    strings: [{
      instrument: "violin",
      name: "Violin",
      color: "#f0772f",
      nodeIds: [
        "grid-r0-s0", "grid-r0-s2", "grid-r0-s4", // 1, 3, 5.
        "grid-r1-s0", "grid-r1-s1", "grid-r1-s2", "grid-r1-s3", "grid-r1-s4", // 14–18.
        "grid-r2-s0", "grid-r2-s1", "grid-r2-s2", "grid-r2-s3", "grid-r2-s4", // 27–31.
        "grid-r3-s0", "grid-r3-s1", "grid-r3-s2", "grid-r3-s3", // 40–43.
      ],
      colorBands: [
        {
          id: "violin1",
          color: "#f0772f",
          nodeIds: [
            "grid-r0-s0", "grid-r0-s2", // 1, 3.
            "grid-r1-s0", "grid-r1-s1", "grid-r1-s2", // 14–16.
            "grid-r2-s0", "grid-r2-s1", "grid-r2-s2", // 27–29.
            "grid-r3-s0", "grid-r3-s1", "grid-r3-s2", // 40–42.
          ],
        },
        {
          id: "violin2",
          color: "#F26850",
          nodeIds: [
            "grid-r0-s4", // 5.
            "grid-r1-s3", "grid-r1-s4", // 17, 18.
            "grid-r2-s3", "grid-r2-s4", // 30, 31.
            "grid-r3-s3", // 43.
          ],
        },
      ],
    }, {
      instrument: "viola",
      name: "Viola",
      color: "#F75A71",
      nodeIds: [
        "grid-r0-s6", "grid-r0-s8", // 7, 9.
        "grid-r1-s9", // 23.
        "grid-r2-s9", "grid-r3-s9", // 36, 49.
      ],
    }, {
      instrument: "cello",
      name: "Cello",
      color: "#FF0F7B",
      nodeIds: [
        "grid-r0-s10", "grid-r0-s12", // 11, 13.
        "grid-r1-s10", "grid-r1-s11", "grid-r1-s12", // 24–26.
        "grid-r2-s10", "grid-r2-s11", "grid-r2-s12", // 37–39.
      ],
    }, {
      instrument: "doubleBass",
      name: "Double-bass",
      color: "#C8168F",
      nodeIds: ["grid-r3-s10", "grid-r3-s11", "grid-r3-s12"], // 50–52.
    }],
  },
  nodeSizeMultipliers: {
    "grid-r2-s4": 0.8, // 31, matching node 30.
    "grid-r4-s11": 1.5, // 64, matching node 50.
    "grid-r4-s1": 1.5,
    "grid-r4-s2": 1.5, // 54-55.
    "grid-r4-s4": 1.2, // 57, matching horns.
    "grid-r4-s5": 1.5,
    "grid-r4-s6": 1.5, // 58-59.
    "grid-r4-s9": 1.2,
    "grid-r4-s10": 1.2, // 62, 63.
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
    // Woodwinds: 19–22, 32–35. Node 31 belongs to Strings.
    "grid-r1-s5": "woodwinds",
    "grid-r1-s6": "woodwinds",
    "grid-r1-s7": "woodwinds",
    "grid-r1-s8": "woodwinds",
    "grid-r2-s4": "strings",
    "grid-r2-s5": "woodwinds",
    "grid-r2-s6": "woodwinds",
    "grid-r2-s7": "woodwinds",
    "grid-r2-s8": "woodwinds",
    // Brass: 45–47, 60–64.
    "grid-r3-s5": "brass",
    "grid-r3-s6": "brass",
    "grid-r3-s7": "brass",
    "grid-r4-s7": "brass",
    "grid-r4-s8": "brass",
    "grid-r4-s9": "brass",
    "grid-r4-s10": "brass",
    "grid-r4-s11": "brass",
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
  sections: {
    grid: { name: "Polar grid", family: "auxiliary", color: "#bac3cd" },
    strings: {
      name: "Strings",
      family: "strings",
      color: "#FC5552",
    },
    woodwinds: {
      name: "Woodwinds",
      family: "woodwinds",
      color: "#376BC9",
    },
    brass: {
      name: "Brass",
      family: "brass",
      color: "#F0AE3B",
    },
    percussion: {
      name: "Percussion",
      family: "percussion",
      color: "#a887c4",
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
