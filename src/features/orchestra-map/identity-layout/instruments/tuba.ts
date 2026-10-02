import { instrumentLayout } from "../defaults";

export const tubaIdentityLayout = instrumentLayout({
  landscape: {
    top: "45%",
    left: "70%",
    anchor: "top-right",
    fontSize: "clamp(54px, 10vw, 90px)",
  },
  portrait: {
    top: "50%",
    left: "-35%",
    anchor: "bottom-center",
    fontSize: "clamp(74px, 12vw, 90px)",
  },
});
