
import { useMemo } from 'react';

export function useSafeArray<T>(data: T[] | undefined | null): T[] {
  return useMemo(() => {
    if (!data || !Array.isArray(data)) {
      return [];
    }
    return data;
  }, [data]);
}

export function useSafeArrayFilter<T>(
  data: T[] | undefined | null,
  filterFn: (item: T) => boolean
): T[] {
  const safeData = useSafeArray(data);
  return useMemo(() => {
    return safeData.filter(filterFn);
  }, [safeData, filterFn]);
}
