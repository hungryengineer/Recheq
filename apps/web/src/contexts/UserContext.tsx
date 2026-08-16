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

export function UserProvider({ children }: { children: ReactNode }) {
  const [avatar, setAvatar] = useState<string | null>(null);
  const [name, setName] = useState<string>('Arun Kumar');
  const [email, setEmail] = useState<string>('admin@recheq.com');
  const [companyName, setCompanyName] = useState<string>('Acme Technologies Pvt Ltd');

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
