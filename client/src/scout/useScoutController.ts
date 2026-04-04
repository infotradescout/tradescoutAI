import { useScoutState } from "./state";

// Thin orchestration hook: keeps ScoutOS focused on layout/rendering while
// centralizing state-controller wiring in one place.
export function useScoutController() {
  const { state, recordUserMessage, applyServerResponse, setError, setStatus } = useScoutState();

  return {
    state,
    recordUserMessage,
    applyServerResponse,
    setError,
    setStatus,
  };
}
