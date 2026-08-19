export {};

declare global {
  namespace Express {
    interface User {
      id?: string;
      role?: string | null;
      email?: string;
      claims?: { sub?: string; [key: string]: unknown };
      [key: string]: unknown;
    }
  }
}
