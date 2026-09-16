import ts from "typescript";
import { resolveScoutRequestCompletion, submitScoutRequest, SCOUT_REQUEST_UNCONFIRMED_MESSAGE } from "./scoutRequestCompletion";

function extractCallback(): string {

      if (name === "./scoutRequestCompletion") return { resolveScoutRequestCompletion, submitScoutRequest };
      if (name === "@/lib/queryClient") return { queryClient: { invalidateQueries } };
