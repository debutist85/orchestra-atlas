import type { OrchestraInstrument } from "../config";
import { bassoonIdentityLayout } from "./instruments/bassoon";
import { celestaIdentityLayout } from "./instruments/celesta";
import { celloIdentityLayout } from "./instruments/cello";
import { clarinetIdentityLayout } from "./instruments/clarinet";
import { contrabassIdentityLayout } from "./instruments/contrabass";
import { fluteIdentityLayout } from "./instruments/flute";
import { harpIdentityLayout } from "./instruments/harp";
import { hornIdentityLayout } from "./instruments/horn";
import { keyboardIdentityLayout } from "./instruments/keyboard";
import { oboeIdentityLayout } from "./instruments/oboe";
import { percussionIdentityLayout } from "./instruments/percussion";
import { pianoIdentityLayout } from "./instruments/piano";
import { pitchedPercussionIdentityLayout } from "./instruments/pitched-percussion";
import { timpaniIdentityLayout } from "./instruments/timpani";
import { tromboneIdentityLayout } from "./instruments/trombone";
import { trumpetIdentityLayout } from "./instruments/trumpet";
import { tubaIdentityLayout } from "./instruments/tuba";
import { unpitchedPercussionIdentityLayout } from "./instruments/unpitched-percussion";
import { violaIdentityLayout } from "./instruments/viola";
import { violinIdentityLayout } from "./instruments/violin";
import { violin1IdentityLayout } from "./instruments/violin-1";
import { violin2IdentityLayout } from "./instruments/violin-2";
import type { IdentityLayouts } from "./types";

export const instrumentIdentityLayouts: Record<OrchestraInstrument, IdentityLayouts> = {
  violin: violinIdentityLayout,
  violin1: violin1IdentityLayout,
  violin2: violin2IdentityLayout,
  viola: violaIdentityLayout,
  cello: celloIdentityLayout,
  doubleBass: contrabassIdentityLayout,
  flute: fluteIdentityLayout,
  oboe: oboeIdentityLayout,
  clarinet: clarinetIdentityLayout,
  bassoon: bassoonIdentityLayout,
  horn: hornIdentityLayout,
  trumpet: trumpetIdentityLayout,
  trombone: tromboneIdentityLayout,
  tuba: tubaIdentityLayout,
  percussion: percussionIdentityLayout,
  timpani: timpaniIdentityLayout,
  pitchedPercussion: pitchedPercussionIdentityLayout,
  unpitchedPercussion: unpitchedPercussionIdentityLayout,
  harp: harpIdentityLayout,
  piano: pianoIdentityLayout,
  keyboard: keyboardIdentityLayout,
  celesta: celestaIdentityLayout,
};
