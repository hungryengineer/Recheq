'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { UAParser } from 'ua-parser-js';

export function SecurityTab() {
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [isEnabling2FA, setIsEnabling2FA] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const [activeSessions, setActiveSessions] = useState([
    { id: 'current', device: 'Loading...', location: 'Loading...', isCurrent: true },
    { id: 'iphone', device: 'iPhone 13 • Safari', location: 'New York, America', isCurrent: false },
    { id: 'windows', device: 'Windows 11 • Edge', location: 'Boston, America', isCurrent: false }
  ]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const parser = new UAParser(window.navigator.userAgent);
      const result = parser.getResult();
      const os = result.os.name || 'Unknown OS';
      const browser = result.browser.name || 'Unknown Browser';
      const deviceName = `${os} • ${browser}`;

      let location = 'Unknown Location';
      try {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (timeZone) {
          const parts = timeZone.split('/');
          location = parts[parts.length - 1].replace(/_/g, ' ') + (parts.length > 1 ? `, ${parts[0]}` : '');
        }
      } catch(e) {}

      setActiveSessions(prev => [
        { id: 'current', device: deviceName, location, isCurrent: true },
        prev[1],
        prev[2]
      ]);
    }
  }, []);

  const handleUpdatePassword = async () => {
    setIsUpdatingPassword(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    setIsUpdatingPassword(false);
    toast.success('Password update email sent. Check your inbox.');
  };

  const handleToggle2FA = async () => {
    setIsEnabling2FA(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsEnabling2FA(false);
    
    if (is2FAEnabled) {
      setIs2FAEnabled(false);
      toast.info('Two-factor authentication disabled');
    } else {
      setIs2FAEnabled(true);
      toast.success('Two-factor authentication successfully enabled');
    }
  };

  const handleSignoutOtherDevices = async () => {
    setIsSigningOut(true);
    await new Promise(resolve => setTimeout(resolve, 600));
    setActiveSessions(prev => prev.filter(session => session.isCurrent));
    setIsSigningOut(false);
    toast.success('Successfully signed out of all other devices');
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h2 className="text-lg font-medium text-[var(--color-fg)]">Security Settings</h2>
        <p className="text-sm text-[var(--color-fg-muted)] mt-1 mb-6">
          Protect your account and manage authentication methods.
        </p>
        <hr className="border-[var(--color-border)] mb-6" />
      </div>

      <div className="grid gap-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="w-full md:w-1/3">
            <label className="block text-sm font-medium text-[var(--color-fg)]">Password</label>
            <p className="text-xs text-[var(--color-fg-muted)] mt-1">Last changed 3 months ago.</p>
          </div>
          <div className="w-full md:w-2/3">
            <button 
              onClick={handleUpdatePassword}
              disabled={isUpdatingPassword}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-[var(--color-fg)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-control)] shadow-sm hover:bg-gray-50 disabled:opacity-70 active:scale-95 transition-all"
            >
              {isUpdatingPassword ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {isUpdatingPassword ? 'Processing...' : 'Update password'}
            </button>
          </div>
        </div>

        <hr className="border-[var(--color-border)]" />

        <div className="flex flex-col md:flex-row md:items-start gap-4">
          <div className="w-full md:w-1/3">
            <label className="block text-sm font-medium text-[var(--color-fg)]">Two-factor Authentication</label>
            <p className="text-xs text-[var(--color-fg-muted)] mt-1">Add an extra layer of security to your account.</p>
          </div>
          <div className="w-full md:w-2/3">
            <div className="flex items-center gap-3 mb-3">
              {is2FAEnabled ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--color-ok-bg)] text-[var(--color-ok)]">Enabled</span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--color-high-bg)] text-[var(--color-high)]">Disabled</span>
              )}
            </div>
            <button 
              onClick={handleToggle2FA}
              disabled={isEnabling2FA}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-[var(--color-surface)] bg-[var(--color-fg)] rounded-[var(--radius-control)] shadow-sm hover:opacity-90 disabled:opacity-70 active:scale-95 transition-all"
            >
              {isEnabling2FA ? <Loader2 className="w-4 h-4 mr-2 animate-spin text-[var(--color-surface)]" /> : null}
              {is2FAEnabled ? 'Disable 2FA' : 'Enable 2FA'}
            </button>
          </div>
        </div>

        <hr className="border-[var(--color-border)]" />

        <div className="flex flex-col md:flex-row md:items-start gap-4">
          <div className="w-full md:w-1/3">
            <label className="block text-sm font-medium text-[var(--color-fg)]">Active Sessions</label>
          </div>
          <div className="w-full md:w-2/3">
            <div className="space-y-3 mb-4">
              {activeSessions.map(session => (
                <div key={session.id} className="border border-[var(--color-border)] rounded-[var(--radius-control)] p-3 flex justify-between items-center bg-[var(--color-surface)]">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-fg)]">{session.device}</p>
                    <p className="text-xs text-[var(--color-fg-muted)]">{session.location} {session.isCurrent ? '• Current session' : ''}</p>
                  </div>
                  {session.isCurrent ? (
                    <span className="text-xs font-medium text-[var(--color-ok)]">Active</span>
                  ) : (
                    <span className="text-xs font-medium text-[var(--color-fg-subtle)]">2 hrs ago</span>
                  )}
                </div>
              ))}
            </div>
            
            {activeSessions.length > 1 && (
              <button 
                onClick={handleSignoutOtherDevices}
                disabled={isSigningOut}
                className="text-sm text-[var(--color-high)] font-medium hover:underline disabled:opacity-70 inline-flex items-center"
              >
                {isSigningOut ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : null}
                Sign out of all other devices
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
