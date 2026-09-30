import { useCallback, useEffect, useRef } from "react";
import type { ScoutMessage } from "./state";
import {
  clearScoutReturnForNewLaunch,
  clearScoutReturnSnapshot,
  takeScoutReturnSnapshot,
} from "./scoutReturnSnapshot";

type ReturnRestorationOptions = {
  authLoading: boolean;
  authTrusted: boolean;
  owner: string | null;
  currentLocation: string;
  explicitLaunch: boolean;
  hasCurrentThread: boolean;
  loadMessages: (messages: ScoutMessage[]) => void;
  onRestore: (activeSavedThreadId: string | null) => void;
};

export function useScoutReturnRestoration({
  authLoading,
  authTrusted,
  owner,
  currentLocation,
  explicitLaunch,
  hasCurrentThread,
  loadMessages,
  onRestore,
}: ReturnRestorationOptions): (messages: ScoutMessage[]) => boolean {
  const restoredMessagesRef = useRef<ScoutMessage[] | null>(null);

  useEffect(() => {
    // A new explicit launch owns its own task, even while auth is resolving.
    clearScoutReturnForNewLaunch(currentLocation, explicitLaunch);
    if (hasCurrentThread) {
      clearScoutReturnSnapshot();
      return;
    }
    if (authLoading) return;
    if (!authTrusted) {
      // React Query may retain a cached user after failed revalidation.
      clearScoutReturnSnapshot();
      return;
    }
    const restored = takeScoutReturnSnapshot(owner);
    if (!restored) return;
    restoredMessagesRef.current = restored.messages;
    onRestore(restored.activeSavedThreadId);
    loadMessages(restored.messages);
  }, [
    authLoading,
    authTrusted,
    currentLocation,
    explicitLaunch,
    hasCurrentThread,
    loadMessages,
    onRestore,
    owner,
  ]);

  return useCallback((messages: ScoutMessage[]) => {
    const restored = restoredMessagesRef.current;
    if (!restored) return false;
    // Restoration dispatch runs after the first empty-render save effect.
    if (messages.length === 0 || messages === restored) return true;
    restoredMessagesRef.current = null;
    return false;
  }, []);
}
