import type { CaseData, CaseId } from "@/lib/types";
import { cpg } from "./cpg";
import { prePmf } from "./pre-pmf";
import { scaleUp } from "./scale-up";

export const seeds: Record<CaseId, CaseData> = {
  fieldnote: prePmf,
  tessellate: scaleUp,
  brightwell: cpg,
};
