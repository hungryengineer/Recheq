'use client';

import React, { createContext, useContext, useState, type ReactNode } from 'react';

interface UserContextType {
  avatar: string | null;
  setAvatar: (avatar: string | null) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [avatar, setAvatar] = useState<string | null>(null);

  return (
    <UserContext.Provider value={{ avatar, setAvatar }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
