'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Plus, MoreHorizontal, Loader2 } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';

export function OrganizationTab() {
  const [isUpdating, setIsUpdating] = useState(false);
  const { companyName, setCompanyName, name, email } = useUser();
  const [localCompanyName, setLocalCompanyName] = useState(companyName);

  // Calculate initials dynamically
  const getInitials = (fullName: string) => {
    return (
      fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase() || 'U'
    );
  };

  const [members, setMembers] = useState([
    { id: 1, role: 'Owner', color: 'blue' },
    { id: 2, name: 'Sarah Jenkins', email: 'sarah@acme.com', role: 'Verifier', color: 'emerald' },
  ]);

  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const handleUpdateCompany = async () => {
    setIsUpdating(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setCompanyName(localCompanyName);
      toast.success('Organization updated successfully');
    } catch {
      toast.error('Failed to update organization');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleInvite = () => {
    toast.success('Invitation link copied to clipboard!');
  };

  const handleRemoveMember = (id: number) => {
    if (id === 1) {
      toast.error('Cannot remove the organization owner');
      return;
    }
    setMembers((prev) => prev.filter((m) => m.id !== id));
    toast.success('Member removed');
  };

  return (
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
          <label
            htmlFor="companyNameInput"
            className="block text-sm font-medium text-[var(--color-fg)]"
          >
            Company name
          </label>
        </div>
        <div className="w-full md:w-2/3 flex gap-2">
          <input
            id="companyNameInput"
            type="text"
            value={localCompanyName}
            onChange={(e) => setLocalCompanyName(e.target.value)}
            className="max-w-md w-full rounded-[var(--radius-control)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-fg)] bg-[var(--color-page)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-shadow"
          />
          <button
            onClick={handleUpdateCompany}
            disabled={isUpdating}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-[var(--color-fg)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-control)] shadow-sm hover:bg-gray-50 disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-1 active:scale-95 transition-all"
          >
            {isUpdating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {isUpdating ? 'Updating...' : 'Update'}
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-[var(--color-fg)]">Team Members</h3>
            <p className="text-xs text-[var(--color-fg-muted)] mt-1">
              Users who have access to this workspace.
            </p>
          </div>
          <button
            onClick={handleInvite}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-[var(--color-fg)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-control)] shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />
            Invite member
          </button>
        </div>

        <div className="border border-[var(--color-border)] rounded-[var(--radius-card)] overflow-hidden">
          <table className="min-w-full divide-y divide-[var(--color-border)]">
            <thead className="bg-[var(--color-page)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-fg-muted)] uppercase">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-fg-muted)] uppercase">
                  Role
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--color-fg-muted)] uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
              {members.map((member) => {
                const memberName = member.id === 1 ? name : member.name;
                const memberEmail = member.id === 1 ? email : member.email;
                const memberInitials =
                  member.id === 1 ? getInitials(name) : getInitials(member.name || '');
                return (
                  <tr key={member.id} className="hover:bg-[var(--color-page)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full bg-${member.color}-100 dark:bg-${member.color}-900/30 text-xs font-semibold text-${member.color}-700 dark:text-${member.color}-400`}
                        >
                          {memberInitials}
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-[var(--color-fg)]">{memberName}</p>
                          <p className="text-xs text-[var(--color-fg-muted)]">{memberEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--color-fg)]">{member.role}</td>
                    <td className="px-4 py-3 text-right text-sm relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === member.id ? null : member.id)}
                        aria-expanded={openMenuId === member.id}
                        aria-label="Member actions"
                        className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                      >
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                      {openMenuId === member.id && (
                        <div className="absolute right-8 top-8 w-32 bg-[var(--color-surface)] border border-[var(--color-border)] rounded shadow-lg z-10 overflow-hidden">
                          <button
                            onClick={() => {
                              handleRemoveMember(member.id);
                              setOpenMenuId(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-[var(--color-page)] transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
