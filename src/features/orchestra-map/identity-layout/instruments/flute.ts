import { instrumentLayout } from "../defaults";

export const fluteIdentityLayout = instrumentLayout({
  landscape: {
    top: "-50%",
    left: "70%",
    anchor: "top-center",
  },
  portrait: {
    top: "-180%",
    left: "0%",
    anchor: "top-center",
  },
});
