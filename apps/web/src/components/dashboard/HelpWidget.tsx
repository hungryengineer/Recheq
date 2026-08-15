'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { LifeBuoy, Activity, Book, MessageSquare, ChevronUp, ExternalLink } from 'lucide-react';

export function HelpWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (widgetRef.current && !widgetRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="fixed bottom-6 left-6 z-50" ref={widgetRef}>
      {/* Widget Menu */}
      {isOpen && (
        <div className="absolute bottom-16 left-0 w-64 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-card)] shadow-xl overflow-hidden animate-fade-in origin-bottom-left">
          <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-page)]">
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">Admin Resources</h3>
            <p className="text-xs text-[var(--color-fg-muted)] mt-1">Help, docs, and system status</p>
          </div>
          
          <div className="py-2">
            <Link 
              href="#" 
              onClick={(e) => { e.preventDefault(); setIsOpen(false); }}
              className="flex items-center px-4 py-2.5 text-sm text-[var(--color-fg)] hover:bg-[var(--color-page)] transition-colors group"
            >
              <Book className="mr-3 h-4 w-4 text-[var(--color-fg-muted)] group-hover:text-[var(--color-accent)] transition-colors" />
              <span>Platform Documentation</span>
              <ExternalLink className="ml-auto h-3 w-3 text-[var(--color-fg-subtle)] opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
            
            <div className="flex items-center px-4 py-2.5 text-sm text-[var(--color-fg)] hover:bg-[var(--color-page)] transition-colors group cursor-default">
              <Activity className="mr-3 h-4 w-4 text-[var(--color-fg-muted)] group-hover:text-emerald-500 transition-colors" />
              <span>System Status</span>
              <span className="ml-auto flex items-center">
                <span className="relative flex h-2 w-2 mr-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">100%</span>
              </span>
            </div>
            
            <Link 
              href="#" 
              onClick={(e) => { e.preventDefault(); setIsOpen(false); }}
              className="flex items-center px-4 py-2.5 text-sm text-[var(--color-fg)] hover:bg-[var(--color-page)] transition-colors group"
            >
              <MessageSquare className="mr-3 h-4 w-4 text-[var(--color-fg-muted)] group-hover:text-[var(--color-accent)] transition-colors" />
              <span>Contact Support</span>
            </Link>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-12 h-12 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 focus:ring-offset-[var(--color-page)] group"
        aria-label="Help and resources"
      >
        <LifeBuoy className={`w-5 h-5 text-[var(--color-fg-muted)] group-hover:text-[var(--color-fg)] transition-all duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
    </div>
  );
}
