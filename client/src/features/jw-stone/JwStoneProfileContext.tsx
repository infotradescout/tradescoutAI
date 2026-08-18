import { createContext, useContext, type ReactNode } from "react";

type JwStoneProfileContextValue = {
  profileActions: ReactNode | null;
  profileCanonicalUrl: string;
};

const JwStoneProfileContext = createContext<JwStoneProfileContextValue>({
  profileActions: null,
  profileCanonicalUrl: "https://www.thetradescout.com/u/jw-stone",
});

export function JwStoneProfileProvider({
  children,
  profileActions,
  profileCanonicalUrl,
}: {
  children: ReactNode;
  profileActions?: ReactNode;
  profileCanonicalUrl?: string;
}) {
  return (
    <JwStoneProfileContext.Provider
      value={{
        profileActions: profileActions || null,
        profileCanonicalUrl:
          profileCanonicalUrl?.trim() || "https://www.thetradescout.com/u/jw-stone",
      }}
    >
      {children}
    </JwStoneProfileContext.Provider>
  );
}

export function useJwStoneProfileContext(): JwStoneProfileContextValue {
  return useContext(JwStoneProfileContext);
}
