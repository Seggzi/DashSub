// This is likely in @/providers/SupabaseProvider.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Session } from '@supabase/supabase-js';

// 1. Define the type to include isLoading
type SessionContext = {
  session: Session | null;
  isLoading: boolean; // This is what's currently missing
};

const Context = createContext<SessionContext | undefined>(undefined);

export default function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true); // 2. Initialize loading as true

  useEffect(() => {
    // Check active session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false); // 3. Stop loading once check is done
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 4. Provide both values to the app
  return (
    <Context.Provider value={{ session, isLoading }}>
      {children}
    </Context.Provider>
  );
}

export const useSupabaseSession = () => {
  const context = useContext(Context);
  if (context === undefined) {
    throw new Error('useSupabaseSession must be used inside SupabaseProvider');
  }
  return context;
};