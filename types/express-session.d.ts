declare global {
  namespace Express {
    interface User {
      id: string;
      // DB-backed users may have null/empty legacy roles; authorization code normalizes this.
      role?: string | null;
      email: string;
      claims?: { sub?: string; [key: string]: any };
      [key: string]: any;
    }
    interface Request {
      user?: User;
      session?: {
        returnTo?: string;
        originalUser?: User;
        impersonatingRole?: string;
        isImpersonating?: boolean;
        [key: string]: any;
      };
    }
  }
}
export {};
