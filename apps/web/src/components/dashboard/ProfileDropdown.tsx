'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { User, Settings, LogOut, ChevronDown, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ProfileDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full pl-2 pr-3 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-page)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-1"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-semibold text-white shadow-sm">
          AK
        </div>
        <span className="text-sm font-medium text-[var(--color-fg)]">Admin</span>
        <ChevronDown className={`w-4 h-4 text-[var(--color-fg-muted)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-[var(--radius-card)] bg-[var(--color-surface)] shadow-lg ring-1 ring-black ring-opacity-5 border border-[var(--color-border)] z-50 animate-fade-in origin-top-right">
          <div className="px-4 py-3 border-b border-[var(--color-border)]">
            <p className="text-sm text-[var(--color-fg)] font-medium">Arun Kumar</p>
            <p className="text-xs text-[var(--color-fg-muted)] truncate mt-0.5">admin@recheq.com</p>
          </div>
          
          <div className="py-1">
            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center px-4 py-2 text-sm text-[var(--color-fg)] hover:bg-[var(--color-page)] transition-colors"
            >
              <User className="mr-3 h-4 w-4 text-[var(--color-fg-muted)]" />
              Your Profile
            </Link>
            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center px-4 py-2 text-sm text-[var(--color-fg)] hover:bg-[var(--color-page)] transition-colors"
            >
              <Settings className="mr-3 h-4 w-4 text-[var(--color-fg-muted)]" />
              Settings
            </Link>
          </div>
          
          <div className="py-1 border-t border-[var(--color-border)]">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex w-full items-center px-4 py-2 text-sm text-[var(--color-fg)] hover:bg-[var(--color-page)] transition-colors"
            >
              {mounted && theme === 'dark' ? (
                <Sun className="mr-3 h-4 w-4 text-[var(--color-fg-muted)]" />
              ) : (
                <Moon className="mr-3 h-4 w-4 text-[var(--color-fg-muted)]" />
              )}
              {mounted && theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
          </div>
          
          <div className="border-t border-[var(--color-border)] py-1">
            <button
              onClick={() => setIsOpen(false)}
              className="flex w-full items-center px-4 py-2 text-sm text-[var(--color-high)] hover:bg-[var(--color-high-bg)] transition-colors"
            >
              <LogOut className="mr-3 h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
