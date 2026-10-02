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
  ellipse 54% 64% at 70% 38%,
  black 0%,
  black 30%,
  rgb(0 0 0 / 72%) 48%,
  rgb(0 0 0 / 22%) 66%,
  transparent 82%
)`;

// The domain ID remains `doubleBass`; Contrabass is the public caption/path.
export const contrabassIdentityLayout = instrumentLayout({
  landscape: {
    top: "-15%",
    left: "70%",
    anchor: "top-center",
    fontSize: "clamp(76px, 13vmin, 100px)",
    figure: {
      src: artwork,
      width: "clamp(580px, 50vw, 1160px)",
      x: "20%",
      y: "10%",
      rotation: "6deg",
      scale: 1,
      opacity: 0.3,
      mask: landscapeMask,
    },
  },
  portrait: {
    top: "-40%",
    left: "0%",
    anchor: "top-center",
    fontSize: "18vmin",
    figure: {
      src: artwork,
      width: "clamp(200px, 70vh, 700px)",
      x: "2%",
      y: "0%",
      rotation: "8deg",
      scale: 1,
      opacity: 0.32,
      mask: portraitMask,
    },
  },
});
