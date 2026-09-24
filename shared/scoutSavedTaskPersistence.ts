type SavedTask = { id: string; updatedAt: string };

export function saveSavedTaskLocally<T extends SavedTask>(
  task: T,
  existing: T[],
  limit: number,
  writeLocal: (tasks: T[]) => boolean
): T | null {
  const next = [task, ...existing.filter((saved) => saved.id !== task.id)].slice(0, limit);
  return writeLocal(next) ? task : null;
}

export function mergeSavedTasks<T extends SavedTask>(
  primary: T[],
  secondary: T[],
  limit: number,
  excludedIds: ReadonlySet<string> = new Set()
): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const task of [...primary, ...secondary]) {
    if (excludedIds.has(task.id) || seen.has(task.id)) continue;
    seen.add(task.id);
    merged.push(task);
  }
  return merged
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

export function withoutSavedTaskPreference(
  preferences: unknown,
  taskId: string
): Record<string, unknown> | null {
  if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) return null;
  const current = preferences as Record<string, unknown>;
  const scout = current.scout;
  if (!scout || typeof scout !== "object" || Array.isArray(scout)) return null;
  const scoutPreferences = scout as Record<string, unknown>;
  const savedThreads = scoutPreferences.savedThreads;
  if (!Array.isArray(savedThreads)) return null;
  const remaining = savedThreads.filter((task) => task?.id !== taskId);
  if (remaining.length === savedThreads.length) return null;
  return {
    ...current,
    scout: { ...scoutPreferences, savedThreads: remaining },
  };
}

export async function deleteSavedTask<T extends { id: string }>({
  taskId,
  waitForSaves,
  deleteRemote,
  onRemoteDeleted,
  readLocal,
  writeLocal,
}: {
  taskId: string;
  waitForSaves?: () => Promise<unknown>;
  deleteRemote?: () => Promise<{ ok: boolean }>;
  onRemoteDeleted?: () => void;
  readLocal: () => T[];
  writeLocal: (tasks: T[]) => boolean;
}): Promise<T[]> {
  await waitForSaves?.();
  if (deleteRemote) {
    const response = await deleteRemote();
    if (!response.ok) throw new Error("Saved task deletion was not confirmed by the server");
    onRemoteDeleted?.();
  }
  const remaining = readLocal().filter((task) => task.id !== taskId);
  if (!writeLocal(remaining)) throw new Error("Saved task deletion could not be stored on this device");
  return remaining;
}
