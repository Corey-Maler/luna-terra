import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';

export interface NavSection {
  id: string;
  title: string;
  order: number;
}

interface NavGuideContextValue {
  sections: NavSection[];
  activeSection: string | null;
  registerSection: (section: NavSection) => void;
  unregisterSection: (id: string) => void;
  setActiveSection: (id: string | null) => void;
}

const NavGuideContext = createContext<NavGuideContextValue | null>(null);

export function NavGuideProvider({ children }: React.PropsWithChildren) {
  const [sections, setSections] = useState<NavSection[]>([]);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const location = useLocation();

  // Clear sections on route change — each page re-registers its own sections
  const prevPathname = useRef(location.pathname);
  useEffect(() => {
    if (location.pathname !== prevPathname.current) {
      setSections([]);
      setActiveSection(null);
      prevPathname.current = location.pathname;
    }
  }, [location.pathname]);

  const registerSection = useCallback((section: NavSection) => {
    setSections((prev) => {
      if (prev.some((s) => s.id === section.id)) return prev;
      return [...prev, section].sort((a, b) => a.order - b.order);
    });
  }, []);

  const unregisterSection = useCallback((id: string) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return (
    <NavGuideContext.Provider
      value={{ sections, activeSection, registerSection, unregisterSection, setActiveSection }}
    >
      {children}
    </NavGuideContext.Provider>
  );
}

export function useNavGuide(): NavGuideContextValue {
  const ctx = useContext(NavGuideContext);
  if (!ctx) throw new Error('useNavGuide must be used within NavGuideProvider');
  return ctx;
}
