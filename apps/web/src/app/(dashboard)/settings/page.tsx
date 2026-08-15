'use client';

import React, { useState } from 'react';
import { User, Building, Key, CreditCard, Bell, Shield } from 'lucide-react';

const tabs = [
  { id: 'profile', name: 'Profile', icon: User },
  { id: 'organization', name: 'Organization', icon: Building },
  { id: 'api-keys', name: 'API Keys', icon: Key },
  { id: 'billing', name: 'Billing', icon: CreditCard },
  { id: 'notifications', name: 'Notifications', icon: Bell },
  { id: 'security', name: 'Security', icon: Shield },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="py-6 animate-fade-in max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-[var(--color-fg)] tracking-tight">Settings</h1>
        <p className="text-sm text-[var(--color-fg-muted)] mt-1">
          Manage your account settings and preferences.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Navigation */}
        <aside className="w-full md:w-64 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? 'bg-[var(--color-accent-bg)] text-[var(--color-accent)]'
                      : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-page)] hover:text-[var(--color-fg)]'
                  }`}
                >
                  <Icon
                    className={`mr-3 flex-shrink-0 h-4 w-4 ${
                      isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-fg-subtle)]'
                    }`}
                  />
                  <span className="truncate">{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Settings Content Area */}
        <div className="flex-1 bg-[var(--color-surface)] shadow-sm rounded-[var(--radius-card)] border border-[var(--color-border)] p-6 md:p-8 min-h-[500px]">
          {activeTab === 'profile' && (
            <div className="animate-fade-in space-y-6">
              <div>
                <h2 className="text-lg font-medium text-[var(--color-fg)]">Profile Settings</h2>
                <p className="text-sm text-[var(--color-fg-muted)] mt-1 mb-6">
                  Update your personal information and email address.
                </p>
                <hr className="border-[var(--color-border)] mb-6" />
              </div>

              <div className="grid gap-6">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="w-full md:w-1/3">
                    <label className="block text-sm font-medium text-[var(--color-fg)]">Avatar</label>
                    <p className="text-xs text-[var(--color-fg-muted)] mt-1">This will be displayed on your profile.</p>
                  </div>
                  <div className="w-full md:w-2/3 flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xl font-semibold text-white shadow-sm">
                      AK
                    </div>
                    <button className="px-4 py-2 text-sm font-medium text-[var(--color-fg)] bg-white border border-[var(--color-border)] rounded-[var(--radius-control)] shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-1">
                      Change avatar
                    </button>
                  </div>
                </div>

                <hr className="border-[var(--color-border)]" />

                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  <div className="w-full md:w-1/3">
                    <label className="block text-sm font-medium text-[var(--color-fg)]">Full name</label>
                  </div>
                  <div className="w-full md:w-2/3">
                    <input
                      type="text"
                      defaultValue="Arun Kumar"
                      className="max-w-md w-full rounded-[var(--radius-control)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-fg)] bg-[var(--color-page)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  <div className="w-full md:w-1/3">
                    <label className="block text-sm font-medium text-[var(--color-fg)]">Email address</label>
                  </div>
                  <div className="w-full md:w-2/3">
                    <input
                      type="email"
                      defaultValue="admin@recheq.com"
                      className="max-w-md w-full rounded-[var(--radius-control)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-fg)] bg-[var(--color-page)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6 flex justify-end">
                <button className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-fg)] rounded-[var(--radius-control)] shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-1 active:scale-95 transition-all">
                  Save changes
                </button>
              </div>
            </div>
          )}

          {activeTab !== 'profile' && (
            <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in py-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-page)] mb-4">
                <Settings className="h-6 w-6 text-[var(--color-fg-muted)]" />
              </div>
              <h3 className="text-lg font-medium text-[var(--color-fg)]">
                {tabs.find(t => t.id === activeTab)?.name} Settings
              </h3>
              <p className="text-sm text-[var(--color-fg-muted)] mt-1 max-w-sm">
                This section is currently under development. Enterprise configuration options will be available here soon.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
