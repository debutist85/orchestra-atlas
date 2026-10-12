import { familyLayout } from "../defaults";

const artwork = "/images/instruments/brass.webp";
const landscapeMask = `radial-gradient(
  ellipse 94% 76% at 66% 38%,
  black 0%,
  black 34%,
  rgb(0 0 0 / 76%) 52%,
  rgb(0 0 0 / 24%) 70%,
  transparent 86%
)`;
const portraitMask = `radial-gradient(
  ellipse 58% 56% at 48% 42%,
  black 0%,
  black 30%,
  rgb(0 0 0 / 72%) 48%,
  rgb(0 0 0 / 22%) 66%,
  transparent 82%
)`;

export const brassIdentityLayout = familyLayout({
  landscape: {
    top: "-50%",
    left: "0%",
    anchor: "bottom-center",
    fontSize: "clamp(30px, 3vw, 90px)",
    figure: {
      src: artwork,
      width: "clamp(300px, 50vw, 700px)",
      x: "45%",
      y: "-40%",
      rotation: "30deg",
      scale: 1,
      opacity: 0.2,
      mask: landscapeMask,
    },
  },
  portrait: {
    top: "-150%",
    left: "10%",
    anchor: "bottom-center",
    fontSize: "clamp(42px, 10vw, 130px)",
    figure: {
      src: artwork,
      width: "clamp(180px, 90vw, 640px)",
      x: "-10%",
      y: "28%",
      rotation: "12deg",
      scale: 1,
      opacity: 0.34,
      mask: portraitMask,
    },
  },
});
