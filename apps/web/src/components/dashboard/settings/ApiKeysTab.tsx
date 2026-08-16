'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Copy, Check } from 'lucide-react';

export function ApiKeysTab() {
  const [keys, setKeys] = useState([
    { id: 'prod', name: 'Production Key', secret: 'req_live_****************a8f9', fullSecret: 'req_live_fake_key_12345', date: 'Oct 12, 2025' },
    { id: 'test', name: 'Staging Environment', secret: 'req_test_****************b2c3', fullSecret: 'req_test_fake_key_67890', date: 'Aug 4, 2026' }
  ]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    toast.success('API Key copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleGenerate = () => {
    const newId = Math.random().toString(36).substring(7);
    const newSecret = `req_live_fake_key_${newId}`;
    setKeys([
      {
        id: newId,
        name: 'New API Key',
        secret: `req_live_****************${newId.substring(0,4)}`,
        fullSecret: newSecret,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      },
      ...keys
    ]);
    toast.success('New API Key generated successfully!');
  };

  const handleRevoke = (id: string) => {
    setKeys(prev => prev.filter(k => k.id !== id));
    toast.error('API Key revoked permanently');
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-lg font-medium text-[var(--color-fg)]">API Keys</h2>
          <p className="text-sm text-[var(--color-fg-muted)] mt-1 mb-6">
            Manage API keys used to authenticate programmatic requests to the Recheq API.
          </p>
        </div>
        <button 
          onClick={handleGenerate}
          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 active:scale-[0.98] transition-all"
        >
          <Plus className="w-4 h-4 mr-1.5 opacity-80" strokeWidth={2.5} />
          Generate Key
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
            {keys.map(key => (
              <tr key={key.id} className="hover:bg-[var(--color-page)] transition-colors">
                <td className="px-4 py-4 text-sm font-medium text-[var(--color-fg)]">{key.name}</td>
                <td className="px-4 py-4">
                  <div className="flex items-center">
                    <code className="text-xs bg-[var(--color-page)] px-2 py-1 rounded border border-[var(--color-border)] font-mono text-[var(--color-fg-muted)]">
                      {key.secret}
                    </code>
                    <button 
                      onClick={() => handleCopy(key.id, key.fullSecret)}
                      className="ml-2 text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] transition-colors"
                      title="Copy full secret key"
                    >
                      {copiedKey === key.id ? <Check className="w-4 h-4 text-[var(--color-ok)]" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-[var(--color-fg-muted)]">{key.date}</td>
                <td className="px-4 py-4 text-right text-sm">
                  <button 
                    onClick={() => handleRevoke(key.id)}
                    className="text-[var(--color-high)] hover:text-red-700 text-xs font-medium px-2 py-1 bg-[var(--color-high-bg)] rounded"
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
            {keys.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-[var(--color-fg-muted)]">
                  No API keys found. Generate one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
