'use client';

import React, { useState } from 'react';
import { User, Building, Key, CreditCard, Bell, Shield, Settings, Copy, Plus, MoreHorizontal, Check, Download } from 'lucide-react';

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
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

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
          
          {/* PROFILE TAB */}
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
                    <button className="px-4 py-2 text-sm font-medium text-[var(--color-fg)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-control)] shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-1 active:scale-95 transition-all">
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
                      className="max-w-md w-full rounded-[var(--radius-control)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-fg)] bg-[var(--color-page)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-shadow"
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
                      className="max-w-md w-full rounded-[var(--radius-control)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-fg)] bg-[var(--color-page)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-shadow"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6 flex justify-end">
                <button className="px-4 py-2 text-sm font-medium text-[var(--color-surface)] bg-[var(--color-fg)] rounded-[var(--radius-control)] shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-1 active:scale-95 transition-all">
                  Save changes
                </button>
              </div>
            </div>
          )}

          {/* ORGANIZATION TAB */}
          {activeTab === 'organization' && (
            <div className="animate-fade-in space-y-6">
              <div>
                <h2 className="text-lg font-medium text-[var(--color-fg)]">Organization</h2>
                <p className="text-sm text-[var(--color-fg-muted)] mt-1 mb-6">
                  Manage your team, roles, and company details.
                </p>
                <hr className="border-[var(--color-border)] mb-6" />
              </div>

              <div className="flex flex-col md:flex-row md:items-start gap-4 mb-8">
                <div className="w-full md:w-1/3">
                  <label className="block text-sm font-medium text-[var(--color-fg)]">Company name</label>
                </div>
                <div className="w-full md:w-2/3 flex gap-2">
                  <input
                    type="text"
                    defaultValue="Acme Technologies Pvt Ltd"
                    className="max-w-md w-full rounded-[var(--radius-control)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-fg)] bg-[var(--color-page)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-shadow"
                  />
                  <button className="px-4 py-2 text-sm font-medium text-[var(--color-fg)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-control)] shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-1 active:scale-95 transition-all">
                    Update
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-medium text-[var(--color-fg)]">Team Members</h3>
                    <p className="text-xs text-[var(--color-fg-muted)] mt-1">Users who have access to this workspace.</p>
                  </div>
                  <button className="inline-flex items-center px-3 py-2 text-sm font-medium text-[var(--color-fg)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-control)] shadow-sm hover:bg-gray-50 active:scale-95 transition-all">
                    <Plus className="w-4 h-4 mr-2" />
                    Invite member
                  </button>
                </div>
                
                <div className="border border-[var(--color-border)] rounded-[var(--radius-card)] overflow-hidden">
                  <table className="min-w-full divide-y divide-[var(--color-border)]">
                    <thead className="bg-[var(--color-page)]">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-fg-muted)] uppercase">User</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-fg-muted)] uppercase">Role</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-[var(--color-fg-muted)] uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
                      <tr className="hover:bg-[var(--color-page)] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">AK</div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-[var(--color-fg)]">Arun Kumar</p>
                              <p className="text-xs text-[var(--color-fg-muted)]">admin@recheq.com</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-[var(--color-fg)]">Owner</td>
                        <td className="px-4 py-3 text-right text-sm">
                          <button className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"><MoreHorizontal className="w-5 h-5" /></button>
                        </td>
                      </tr>
                      <tr className="hover:bg-[var(--color-page)] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">SJ</div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-[var(--color-fg)]">Sarah Jenkins</p>
                              <p className="text-xs text-[var(--color-fg-muted)]">sarah@acme.com</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-[var(--color-fg)]">Verifier</td>
                        <td className="px-4 py-3 text-right text-sm">
                          <button className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"><MoreHorizontal className="w-5 h-5" /></button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* API KEYS TAB */}
          {activeTab === 'api-keys' && (
            <div className="animate-fade-in space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-medium text-[var(--color-fg)]">API Keys</h2>
                  <p className="text-sm text-[var(--color-fg-muted)] mt-1 mb-6">
                    Manage API keys used to authenticate programmatic requests to the Recheq API.
                  </p>
                </div>
                <button className="inline-flex items-center px-4 py-2 text-sm font-medium text-[var(--color-surface)] bg-[var(--color-fg)] rounded-[var(--radius-control)] shadow-sm hover:opacity-90 active:scale-95 transition-all">
                  <Plus className="w-4 h-4 mr-2" />
                  Generate new key
                </button>
              </div>
              <hr className="border-[var(--color-border)] mb-6" />

              <div className="border border-[var(--color-border)] rounded-[var(--radius-card)] overflow-hidden">
                <table className="min-w-full divide-y divide-[var(--color-border)]">
                  <thead className="bg-[var(--color-page)]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-fg-muted)] uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-fg-muted)] uppercase">Secret Key</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-fg-muted)] uppercase">Created</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-[var(--color-fg-muted)] uppercase"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
                    <tr className="hover:bg-[var(--color-page)] transition-colors">
                      <td className="px-4 py-4 text-sm font-medium text-[var(--color-fg)]">Production Key</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center">
                          <code className="text-xs bg-[var(--color-page)] px-2 py-1 rounded border border-[var(--color-border)] font-mono text-[var(--color-fg-muted)]">
                            req_live_****************a8f9
                          </code>
                          <button 
                            onClick={() => handleCopy('prod-key', 'req_live_fake_key_12345')}
                            className="ml-2 text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] transition-colors"
                          >
                            {copiedKey === 'prod-key' ? <Check className="w-4 h-4 text-[var(--color-ok)]" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-[var(--color-fg-muted)]">Oct 12, 2025</td>
                      <td className="px-4 py-4 text-right text-sm">
                        <button className="text-[var(--color-high)] hover:text-red-700 text-xs font-medium px-2 py-1 bg-[var(--color-high-bg)] rounded">Revoke</button>
                      </td>
                    </tr>
                    <tr className="hover:bg-[var(--color-page)] transition-colors">
                      <td className="px-4 py-4 text-sm font-medium text-[var(--color-fg)]">Staging Environment</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center">
                          <code className="text-xs bg-[var(--color-page)] px-2 py-1 rounded border border-[var(--color-border)] font-mono text-[var(--color-fg-muted)]">
                            req_test_****************b2c3
                          </code>
                          <button 
                            onClick={() => handleCopy('test-key', 'req_test_fake_key_67890')}
                            className="ml-2 text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] transition-colors"
                          >
                            {copiedKey === 'test-key' ? <Check className="w-4 h-4 text-[var(--color-ok)]" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-[var(--color-fg-muted)]">Aug 4, 2026</td>
                      <td className="px-4 py-4 text-right text-sm">
                        <button className="text-[var(--color-high)] hover:text-red-700 text-xs font-medium px-2 py-1 bg-[var(--color-high-bg)] rounded">Revoke</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* BILLING TAB */}
          {activeTab === 'billing' && (
            <div className="animate-fade-in space-y-6">
              <div>
                <h2 className="text-lg font-medium text-[var(--color-fg)]">Billing & Plans</h2>
                <p className="text-sm text-[var(--color-fg-muted)] mt-1 mb-6">
                  Manage your subscription, payment methods, and billing history.
                </p>
                <hr className="border-[var(--color-border)] mb-6" />
              </div>

              <div className="bg-gradient-to-r from-[var(--color-surface)] to-[var(--color-page)] border border-[var(--color-border)] rounded-[var(--radius-card)] p-6 mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div>
                  <h3 className="text-sm font-medium text-[var(--color-fg-muted)] uppercase tracking-wide mb-1">Current Plan</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-[var(--color-fg)]">Enterprise</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-ok-bg)] text-[var(--color-ok)]">Active</span>
                  </div>
                  <p className="text-sm text-[var(--color-fg-muted)] mt-2">Unlimited verifications with priority processing.</p>
                </div>
                <button className="mt-4 sm:mt-0 px-4 py-2 text-sm font-medium text-[var(--color-fg)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-control)] shadow-sm hover:bg-gray-50 active:scale-95 transition-all">
                  Manage Plan
                </button>
              </div>

              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 border border-[var(--color-border)] rounded-[var(--radius-card)] p-5">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-medium text-[var(--color-fg)]">Payment Method</h3>
                    <button className="text-[var(--color-accent)] text-xs font-medium hover:underline">Update</button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-8 bg-slate-100 rounded border border-slate-200 flex items-center justify-center">
                      <span className="text-xs font-bold text-slate-600">VISA</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--color-fg)]">Visa ending in 4242</p>
                      <p className="text-xs text-[var(--color-fg-muted)]">Expires 12/2028</p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 border border-[var(--color-border)] rounded-[var(--radius-card)] p-5">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-medium text-[var(--color-fg)]">Usage This Month</h3>
                  </div>
                  <div className="mb-2 flex justify-between items-end">
                    <span className="text-2xl font-bold text-[var(--color-fg)]">1,248</span>
                    <span className="text-xs text-[var(--color-fg-muted)] mb-1">/ Unlimited cases</span>
                  </div>
                  <div className="w-full bg-[var(--color-page)] rounded-full h-2">
                    <div className="bg-[var(--color-accent)] h-2 rounded-full" style={{ width: '45%' }}></div>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <h3 className="text-sm font-medium text-[var(--color-fg)] mb-4">Billing History</h3>
                <div className="border border-[var(--color-border)] rounded-[var(--radius-card)] overflow-hidden">
                  <table className="min-w-full divide-y divide-[var(--color-border)]">
                    <tbody className="bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
                      {[
                        { date: 'Aug 1, 2026', amount: '$499.00', status: 'Paid' },
                        { date: 'Jul 1, 2026', amount: '$499.00', status: 'Paid' },
                        { date: 'Jun 1, 2026', amount: '$499.00', status: 'Paid' }
                      ].map((invoice, i) => (
                        <tr key={i} className="hover:bg-[var(--color-page)] transition-colors">
                          <td className="px-4 py-3 text-sm text-[var(--color-fg)]">{invoice.date}</td>
                          <td className="px-4 py-3 text-sm text-[var(--color-fg)]">{invoice.amount}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-ok-bg)] text-[var(--color-ok)]">{invoice.status}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button className="text-[var(--color-fg-muted)] hover:text-[var(--color-accent)]"><Download className="w-4 h-4 inline" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <div className="animate-fade-in space-y-6">
              <div>
                <h2 className="text-lg font-medium text-[var(--color-fg)]">Notifications</h2>
                <p className="text-sm text-[var(--color-fg-muted)] mt-1 mb-6">
                  Manage how we contact you regarding case updates and system alerts.
                </p>
                <hr className="border-[var(--color-border)] mb-6" />
              </div>

              <div className="space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-[var(--color-fg)]">Case Completions</h3>
                    <p className="text-sm text-[var(--color-fg-muted)] mt-1">Get an email when a verification case is fully processed.</p>
                  </div>
                  <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                    <input type="checkbox" name="toggle" id="toggle1" className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer border-[var(--color-accent)] transform translate-x-5" defaultChecked />
                    <label htmlFor="toggle1" className="toggle-label block overflow-hidden h-5 rounded-full bg-[var(--color-accent)] cursor-pointer"></label>
                  </div>
                </div>
                <hr className="border-[var(--color-border)]" />
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-[var(--color-fg)]">Candidate Document Uploads</h3>
                    <p className="text-sm text-[var(--color-fg-muted)] mt-1">Get notified when a candidate uploads their forms.</p>
                  </div>
                  <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                    <input type="checkbox" name="toggle" id="toggle2" className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer border-gray-300" />
                    <label htmlFor="toggle2" className="toggle-label block overflow-hidden h-5 rounded-full bg-gray-300 cursor-pointer"></label>
                  </div>
                </div>
                <hr className="border-[var(--color-border)]" />
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-[var(--color-fg)]">Billing Receipts</h3>
                    <p className="text-sm text-[var(--color-fg-muted)] mt-1">Receive monthly invoices and billing updates.</p>
                  </div>
                  <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                    <input type="checkbox" name="toggle" id="toggle3" className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer border-[var(--color-accent)] transform translate-x-5" defaultChecked />
                    <label htmlFor="toggle3" className="toggle-label block overflow-hidden h-5 rounded-full bg-[var(--color-accent)] cursor-pointer"></label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECURITY TAB */}
          {activeTab === 'security' && (
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
                    <button className="px-4 py-2 text-sm font-medium text-[var(--color-fg)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-control)] shadow-sm hover:bg-gray-50 active:scale-95 transition-all">
                      Update password
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
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--color-high-bg)] text-[var(--color-high)]">Disabled</span>
                    </div>
                    <button className="px-4 py-2 text-sm font-medium text-[var(--color-surface)] bg-[var(--color-fg)] rounded-[var(--radius-control)] shadow-sm hover:opacity-90 active:scale-95 transition-all">
                      Enable 2FA
                    </button>
                  </div>
                </div>

                <hr className="border-[var(--color-border)]" />

                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  <div className="w-full md:w-1/3">
                    <label className="block text-sm font-medium text-[var(--color-fg)]">Active Sessions</label>
                  </div>
                  <div className="w-full md:w-2/3">
                    <div className="border border-[var(--color-border)] rounded-[var(--radius-control)] p-3 flex justify-between items-center mb-2">
                      <div>
                        <p className="text-sm font-medium text-[var(--color-fg)]">Mac OS • Chrome</p>
                        <p className="text-xs text-[var(--color-fg-muted)]">New York, US • Current session</p>
                      </div>
                      <span className="text-xs font-medium text-[var(--color-ok)]">Active</span>
                    </div>
                    <button className="text-sm text-[var(--color-high)] font-medium hover:underline mt-2">Sign out of all other devices</button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      <style jsx global>{`
        .toggle-checkbox:checked {
          right: 0;
          border-color: var(--color-accent);
        }
        .toggle-checkbox:checked + .toggle-label {
          background-color: var(--color-accent);
        }
      `}</style>
    </div>
  );
}
