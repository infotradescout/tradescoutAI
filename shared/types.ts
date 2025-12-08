// Stub for shared/types
export interface User {
  id?: string;
  role?: string;
  claims?: { sub?: string; [key: string]: any };
  [key: string]: any;
}
