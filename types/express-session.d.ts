declare global {
  namespace Express {
    interface User {
      id: string;
      role: string;
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
