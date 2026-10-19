import { instrumentLayout } from "../defaults";

const artwork = "/images/instruments/clarinet.webp";
const landscapeMask = `radial-gradient(
  ellipse 58% 65% at 33% 25%,
  black 0%,
  black 32%,
  rgb(0 0 0 / 75%) 50%,
  rgb(0 0 0 / 25%) 68%,
  transparent 84%
)`;
const portraitMask = `radial-gradient(
  ellipse 58% 42% at 28% 55%,
  black 0%,
  black 32%,
  rgb(0 0 0 / 75%) 50%,
  rgb(0 0 0 / 25%) 68%,
  transparent 84%
)`;

export const clarinetIdentityLayout = instrumentLayout({
  landscape: {
    edge: "top",
    align: "start",
    side: "outside",
    gap: 2,
    figure: {
      src: artwork,
      width: "clamp(200px, 20vw, 350px)",
      x: "10%",
      y: "20%",
      rotation: "-12deg",
      scale: 1,
      opacity: 0.3,
      mask: landscapeMask,
    },
  },
  portrait: {
    figure: {
      src: artwork,
      width: "clamp(200px, 70vw, 520px)",
      x: "-30%",
      y: "0%",
      rotation: "-12deg",
      scale: 1,
      opacity: 0.3,
      mask: portraitMask,
    },
  },
});
