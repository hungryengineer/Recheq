'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Webhook as WebhookIcon } from 'lucide-react';
import { getWebhooksAction, createWebhookAction, deleteWebhookAction } from '@/lib/api/settings';
import type { Webhook } from '@/lib/api/settings';

export function WebhooksTab() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [url, setUrl] = useState('');
  const [newSecret, setNewSecret] = useState<string | null>(null);

  useEffect(() => {
    async function loadWebhooks() {
      setIsLoading(true);
      setLoadError(null);
      const result = await getWebhooksAction();
      if (result.success) {
        setWebhooks(result.data);
      } else {
        setWebhooks([]);
        setLoadError(result.error);
      }
      setIsLoading(false);
    }
    loadWebhooks();
  }, []);

  const handleCreate = async () => {
    if (!url.trim()) {
      toast.error('Enter a destination URL');
      return;
    }
    setIsCreating(true);
    const result = await createWebhookAction(url.trim(), ['case.completed']);
    setIsCreating(false);

    if (result.success && result.data) {
      setWebhooks([result.data, ...webhooks]);
      setUrl('');
      setNewSecret(result.data.secret);
      toast.success('Webhook created!');
    } else {
      toast.error(result.error || 'Failed to create webhook');
    }
  };

  const handleDelete = async (id: string) => {
    const result = await deleteWebhookAction(id);
    if (result.success) {
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
      toast.success('Webhook deleted');
    } else {
      toast.error(result.error || 'Failed to delete webhook');
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h2 className="text-lg font-medium text-[var(--color-fg)]">Webhooks</h2>
        <p className="text-sm text-[var(--color-fg-muted)] mt-1">
          Receive real-time notifications when a case completes with a verdict.
        </p>
      </div>
      <hr className="border-[var(--color-border)]" />

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-card)] p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setNewSecret(null);
            }}
            placeholder="https://your-app.com/recheq-hook"
            className="flex-1 px-3 py-2 text-sm bg-[var(--color-page)] border border-[var(--color-border)] rounded-[var(--radius-control)] focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isCreating ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-1.5 opacity-80" strokeWidth={2.5} />
            )}
            Add Webhook
          </button>
        </div>
        <p className="text-xs text-[var(--color-fg-subtle)]">
          Subscribes to the{' '}
          <code className="font-mono text-[var(--color-accent)]">case.completed</code> event.
          Deliveries are signed with an HMAC-SHA256 secret you can use to verify authenticity.
        </p>
      </div>

      {newSecret && (
        <div className="bg-[var(--color-accent-bg)] border border-[var(--color-accent)]/40 rounded-[var(--radius-card)] p-4 space-y-2">
          <p className="text-sm font-medium text-[var(--color-fg)]">
            Signing secret (shown once — copy it now)
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-[var(--color-surface)] px-2 py-1.5 rounded border border-[var(--color-border)] font-mono text-[var(--color-fg-muted)] break-all">
              {newSecret}
            </code>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(newSecret);
                toast.success('Secret copied to clipboard');
              }}
              className="text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] transition-colors px-2 py-1.5 border border-[var(--color-border)] rounded-md text-xs"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      <div className="border border-[var(--color-border)] rounded-[var(--radius-card)] overflow-hidden">
        <table className="min-w-full divide-y divide-[var(--color-border)]">
          <thead className="bg-[var(--color-page)]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-fg-muted)] uppercase">
                URL
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-fg-muted)] uppercase">
                Events
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
                  Loading webhooks...
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-[var(--color-high)]">
                  {loadError}
                </td>
              </tr>
            ) : webhooks.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-[var(--color-fg-muted)]"
                >
                  No webhooks configured. Add one to receive case completion notifications.
                </td>
              </tr>
            ) : (
              webhooks.map((webhook) => (
                <tr key={webhook.id} className="hover:bg-[var(--color-page)] transition-colors">
                  <td className="px-4 py-4 text-sm font-medium text-[var(--color-fg)] break-all">
                    {webhook.url}
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-1 text-xs bg-[var(--color-page)] px-2 py-1 rounded border border-[var(--color-border)] font-mono text-[var(--color-fg-muted)]">
                      <WebhookIcon className="w-3 h-3" />
                      {webhook.events.join(', ')}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-[var(--color-fg-muted)]">
                    {new Date(webhook.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-4 text-right text-sm">
                    <button
                      onClick={() => handleDelete(webhook.id)}
                      className="text-[var(--color-high)] hover:text-red-700 text-xs font-medium px-2 py-1 bg-[var(--color-high-bg)] rounded inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
