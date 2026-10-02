import type { FamilyId } from "../utils/navigation";
import { familyLayout } from "./defaults";
import { stringsIdentityLayout } from "./families/strings";
import type { IdentityLayouts } from "./types";

export const orchestraIdentityLayout = familyLayout({
  landscape: {
    top: "0%",
    left: "0%",
    anchor: "top-left",
    fontSize: "clamp(12px, 4vw, 90px)",
  },
  portrait: {
    top: "-80%",
    left: "0%",
    anchor: "top-center",
  },
});

export const familyIdentityLayouts: Record<FamilyId, IdentityLayouts> = {
  strings: stringsIdentityLayout,
  woodwinds: familyLayout({
    landscape: {
      top: "-10%",
      left: "-20%",
      anchor: "top-right",
      fontSize: "clamp(44px, 5vw, 90px)",
    },
    portrait: {
      top: "-100%",
      left: "0%",
      anchor: "top-center",
      fontSize: "clamp(64px, 8vw, 100px)",
    },
  }),
  brass: familyLayout({
    landscape: {
      top: "-30%",
      left: "0%",
      anchor: "bottom-center",
      fontSize: "clamp(74px, 8vw, 100px)",
    },
    portrait: {
      top: "-150%",
      left: "10%",
      anchor: "bottom-center",
      fontSize: "clamp(74px, 8vw, 100px)",
    },
  }),
  percussion: familyLayout({
    landscape: {
      top: "-40%",
      left: "-10%",
      anchor: "top-center",
    },
    portrait: {
      top: "-100%",
      left: "0%",
      anchor: "top-center",
      fontSize: "clamp(54px, 6vw, 100px)",
    },
  }),
  other: familyLayout({
    landscape: {
      top: "30%",
      left: "-30%",
      anchor: "top-left",
    },
    portrait: {
      top: "-80%",
      left: "-10%",
      anchor: "top-center",
    },
  }),
};
