'use client';

import React, { createContext, useContext, useState, type ReactNode } from 'react';

interface UserContextType {
  avatar: string | null;
  setAvatar: (avatar: string | null) => void;
  name: string;
  setName: (name: string) => void;
  email: string;
  setEmail: (email: string) => void;
  companyName: string;
  setCompanyName: (companyName: string) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser?: { name: string; email: string; companyName: string; avatar: string | null };
}) {
  const [avatar, setAvatar] = useState<string | null>(initialUser?.avatar || null);
  const [name, setName] = useState<string>(initialUser?.name || '');
  const [email, setEmail] = useState<string>(initialUser?.email || '');
  const [companyName, setCompanyName] = useState<string>(initialUser?.companyName || '');

  return (
    <UserContext.Provider
      value={{ avatar, setAvatar, name, setName, email, setEmail, companyName, setCompanyName }}
    >
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
