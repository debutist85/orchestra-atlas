import type { FamilyId } from "../utils/navigation";
import { familyLayout } from "./defaults";
import { brassIdentityLayout } from "./families/brass";
import { percussionIdentityLayout } from "./families/percussion";
import { stringsIdentityLayout } from "./families/strings";
import { woodwindsIdentityLayout } from "./families/woodwinds";
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
  woodwinds: woodwindsIdentityLayout,
  brass: brassIdentityLayout,
  percussion: percussionIdentityLayout,
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
