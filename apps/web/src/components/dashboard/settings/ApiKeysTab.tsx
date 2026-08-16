'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Copy, Check, Loader2 } from 'lucide-react';
import { getApiKeysAction, createApiKeyAction, deleteApiKeyAction } from '@/lib/api/settings';
import type { ApiKey } from '@/lib/api/settings';

export function ApiKeysTab() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    async function loadKeys() {
      const data = await getApiKeysAction();
      setKeys(data);
      setIsLoading(false);
    }
    loadKeys();
  }, []);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    toast.success('API Key copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    const result = await createApiKeyAction('New API Key');
    setIsGenerating(false);

    if (result.success && result.data) {
      setKeys([result.data, ...keys]);
      toast.success('New API Key generated successfully!');
      // Let user copy the full secret right away since they might not see it again
      handleCopy(result.data.id, result.data.fullSecret);
    } else {
      toast.error(result.error || 'Failed to generate key');
    }
  };

  const handleRevoke = async (id: string) => {
    const result = await deleteApiKeyAction(id);
    if (result.success) {
      setKeys((prev) => prev.filter((k) => k.id !== id));
      toast.error('API Key revoked permanently');
    } else {
      toast.error(result.error || 'Failed to revoke key');
    }
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
          disabled={isGenerating || isLoading}
          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
          ) : (
            <Plus className="w-4 h-4 mr-1.5 opacity-80" strokeWidth={2.5} />
          )}
          Generate Key
        </button>
      </div>
      <hr className="border-[var(--color-border)] mb-6" />

      <div className="border border-[var(--color-border)] rounded-[var(--radius-card)] overflow-hidden">
        <table className="min-w-full divide-y divide-[var(--color-border)]">
          <thead className="bg-[var(--color-page)]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-fg-muted)] uppercase">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-fg-muted)] uppercase">
                Secret Key
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-fg-muted)] uppercase">
                Created
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-[var(--color-fg-muted)] uppercase"></th>
            </tr>
          </thead>
          <tbody className="bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
            {isLoading ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-[var(--color-fg-muted)]"
                >
                  Loading keys...
                </td>
              </tr>
            ) : (
              keys.map((key, index) => (
                <tr
                  key={`${key.id}-${index}`}
                  className="hover:bg-[var(--color-page)] transition-colors"
                >
                  <td className="px-4 py-4 text-sm font-medium text-[var(--color-fg)]">
                    {key.name}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center">
                      <code className="text-xs bg-[var(--color-page)] px-2 py-1 rounded border border-[var(--color-border)] font-mono text-[var(--color-fg-muted)]">
                        {key.secret}
                      </code>
                      {/* If fullSecret isn't in the object, they can only copy the masked version, but we just use secret for standard view */}
                      <button
                        onClick={() =>
                          handleCopy(
                            key.id,
                            (key as Record<string, string>).fullSecret || key.secret,
                          )
                        }
                        className="ml-2 text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] transition-colors"
                        title="Copy full secret key"
                      >
                        {copiedKey === key.id ? (
                          <Check className="w-4 h-4 text-[var(--color-ok)]" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
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
              ))
            )}
            {!isLoading && keys.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-[var(--color-fg-muted)]"
                >
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
