import { familyLayout } from "../defaults";

export const otherIdentityLayout = familyLayout({
  landscape: {
    top: "30%",
    left: "-30%",
    anchor: "top-left",
    fontSize: "clamp(30px, 3vw, 90px)",
  },
  portrait: {
    top: "-80%",
    left: "-10%",
    anchor: "top-center",
  },
});
