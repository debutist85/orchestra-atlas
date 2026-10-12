import { familyLayout } from "../defaults";

const artwork = "/images/instruments/percussions.webp";
const landscapeMask = `radial-gradient(
  ellipse 64% 86% at 46% 38%,
  black 0%,
  black 34%,
  rgb(0 0 0 / 76%) 52%,
  rgb(0 0 0 / 24%) 70%,
  transparent 86%
)`;
const portraitMask = `radial-gradient(
  ellipse 78% 86% at 38% 32%,
  black 0%,
  black 30%,
  rgb(0 0 0 / 72%) 48%,
  rgb(0 0 0 / 22%) 66%,
  transparent 82%
)`;

export const percussionIdentityLayout = familyLayout({
  landscape: {
    top: "-40%",
    left: "-10%",
    anchor: "top-center",
    fontSize: "clamp(30px, 3vw, 90px)",
    figure: {
      src: artwork,
      width: "clamp(250px, 26vw, 600px)",
      x: "-90%",
      y: "20%",
      rotation: "-6deg",
      scale: 1,
      opacity: 0.2,
      mask: landscapeMask,
    },
  },
  portrait: {
    top: "-100%",
    left: "0%",
    anchor: "top-center",
    fontSize: "clamp(42px, 10vw, 130px)",
    figure: {
      src: artwork,
      width: "clamp(180px, 42vw, 640px)",
      x: "-20%",
      y: "-28%",
      rotation: "-4deg",
      scale: 1,
      opacity: 0.34,
      mask: portraitMask,
    },
  },
});
