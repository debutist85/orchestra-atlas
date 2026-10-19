import { instrumentLayout } from "../defaults";

const artwork = "/images/instruments/contrabass.webp";
const landscapeMask = `radial-gradient(
  ellipse 48% 70% at 75% 62%,
  black 0%,
  black 34%,
  rgb(0 0 0 / 76%) 52%,
  rgb(0 0 0 / 24%) 70%,
  transparent 86%
)`;
const portraitMask = `radial-gradient(
  ellipse 54% 84% at 70% 38%,
  black 0%,
  black 30%,
  rgb(0 0 0 / 72%) 48%,
  rgb(0 0 0 / 22%) 66%,
  transparent 82%
)`;

// The domain ID remains `doubleBass`; Contrabass is the public caption/path.
export const contrabassIdentityLayout = instrumentLayout({
  landscape: {
    edge: "right",
    align: "start",
    side: "outside",
    figure: {
      src: artwork,
      width: "clamp(1200px, 50vw, 1400px)",
      x: "0%",
      y: "0%",
      rotation: "6deg",
      scale: 1,
      opacity: 0.4,
      mask: landscapeMask,
    },
  },
  portrait: {
    figure: {
      src: artwork,
      width: "clamp(200px, 90vh, 900px)",
      x: "2%",
      y: "0%",
      rotation: "8deg",
      scale: 1,
      opacity: 0.32,
      mask: portraitMask,
    },
  },
});
