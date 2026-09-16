import ts from "typescript";
import { resolveScoutRequestCompletion, SCOUT_REQUEST_UNCONFIRMED_MESSAGE } from "./scoutRequestCompletion";

function extractCallback(): string {

      if (name === "./scoutRequestCompletion") return { resolveScoutRequestCompletion };
      if (name === "@/lib/queryClient") return { queryClient: { invalidateQueries } };
