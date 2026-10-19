import { familyLayout } from "../defaults";

const artwork = "/images/instruments/woodwinds.webp";
const landscapeMask = `radial-gradient(
  ellipse 54% 66% at 46% 38%,
  black 0%,
  black 34%,
  rgb(0 0 0 / 76%) 52%,
  rgb(0 0 0 / 24%) 70%,
  transparent 86%
)`;
const portraitMask = `radial-gradient(
  ellipse 58% 66% at 48% 42%,
  black 0%,
  black 30%,
  rgb(0 0 0 / 72%) 48%,
  rgb(0 0 0 / 22%) 66%,
  transparent 82%
)`;

export const woodwindsIdentityLayout = familyLayout({
  landscape: {
    fontSize: "clamp(30px, 3vw, 90px)",
    figure: {
      src: artwork,
      width: "clamp(160px, 26vw, 800px)",
      x: "-1%",
      y: "20%",
      rotation: "-6deg",
      scale: 1,
      opacity: 0.2,
      mask: landscapeMask,
    },
  },
  portrait: {
    fontSize: "clamp(42px, 10vw, 130px)",
    figure: {
      src: artwork,
      width: "clamp(180px, 42vw, 640px)",
      x: "40%",
      y: "20%",
      rotation: "-4deg",
      scale: 1,
      opacity: 0.34,
      mask: portraitMask,
    },
  },
});
