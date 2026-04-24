import React, { createContext, useCallback, useContext, useState } from 'react';

interface FpsContextValue {
  fpsEnabled: boolean;
  setFpsEnabled: (v: boolean) => void;
}

const FpsContext = createContext<FpsContextValue | null>(null);

export function FpsProvider({ children }: React.PropsWithChildren) {
  const [fpsEnabled, setFpsEnabledState] = useState(false);

  const setFpsEnabled = useCallback((v: boolean) => {
    setFpsEnabledState(v);
  }, []);

  return (
    <FpsContext.Provider value={{ fpsEnabled, setFpsEnabled }}>
      {children}
    </FpsContext.Provider>
  );
}

export function useFps(): FpsContextValue {
  const ctx = useContext(FpsContext);
  if (!ctx) throw new Error('useFps must be used within FpsProvider');
  return ctx;
}
