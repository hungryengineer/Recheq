'use client';

import React, { useState } from 'react';
import { User, Building, Key, CreditCard, Bell, Shield } from 'lucide-react';
import { ProfileTab } from '@/components/dashboard/settings/ProfileTab';
import { OrganizationTab } from '@/components/dashboard/settings/OrganizationTab';
import { ApiKeysTab } from '@/components/dashboard/settings/ApiKeysTab';
import { BillingTab } from '@/components/dashboard/settings/BillingTab';
import { NotificationsTab } from '@/components/dashboard/settings/NotificationsTab';
import { SecurityTab } from '@/components/dashboard/settings/SecurityTab';

const ENABLE_MOCK_FEATURES = process.env.NEXT_PUBLIC_ENABLE_MOCK_FEATURES === 'true';

const tabs = [
  { id: 'profile', name: 'Profile', icon: User },
  { id: 'organization', name: 'Organization', icon: Building },
  { id: 'api-keys', name: 'API Keys', icon: Key },
  ...(ENABLE_MOCK_FEATURES ? [{ id: 'billing', name: 'Billing', icon: CreditCard }] : []),
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
                  className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-[var(--radius-control)] transition-colors ${
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
          {activeTab === 'profile' && <ProfileTab />}
          {activeTab === 'organization' && <OrganizationTab />}
          {activeTab === 'api-keys' && <ApiKeysTab />}
          {activeTab === 'billing' && <BillingTab />}
          {activeTab === 'notifications' && <NotificationsTab />}
          {activeTab === 'security' && <SecurityTab />}
        </div>
      </div>
    </div>
  );
}
