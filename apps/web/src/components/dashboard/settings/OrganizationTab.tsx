'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Plus, MoreHorizontal, Loader2, X } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import {
  updateOrganizationAction,
  inviteMemberAction,
  getOrganizationMembersAction,
} from '@/lib/api/settings';

export function OrganizationTab() {
  const [isUpdating, setIsUpdating] = useState(false);
  const { companyName, setCompanyName } = useUser();
  const [localCompanyName, setLocalCompanyName] = useState(companyName);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Invite Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Verifier');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteErrors, setInviteErrors] = useState<Record<string, string>>({});

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

  const [members, setMembers] = useState<
    Array<{ id: string; name: string; email: string; role: string; color: string }>
  >([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);

  React.useEffect(() => {
    async function loadMembers() {
      try {
        const result = await getOrganizationMembersAction();
        if (result && 'data' in result && result.data) {
          const colors = ['blue', 'emerald', 'purple', 'amber', 'rose'];
          setMembers(
            result.data.map((user, i) => ({
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role.charAt(0).toUpperCase() + user.role.slice(1),
              color: colors[i % colors.length],
            })),
          );
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingMembers(false);
      }
    }
    loadMembers();
  }, []);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const handleUpdateCompany = async () => {
    setIsUpdating(true);
    setErrors({});
    try {
      const result = await updateOrganizationAction({ companyName: localCompanyName });
      if (result && 'error' in result) {
        if (result.error.code === 'VALIDATION_ERROR' && result.error.details?.fields) {
          const newErrors: Record<string, string> = {};
          result.error.details.fields.forEach((field) => {
            newErrors[field.path] = field.message;
          });
          setErrors(newErrors);
        } else {
          toast.error(result.error.message || 'Failed to update organization');
        }
        return;
      }
      setCompanyName(localCompanyName);
      toast.success('Organization updated successfully');
    } catch {
      toast.error('Failed to update organization');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviting(true);
    setInviteErrors({});
    try {
      const result = await inviteMemberAction({ email: inviteEmail, role: inviteRole });
      if (result && 'error' in result) {
        if (result.error.code === 'VALIDATION_ERROR' && result.error.details?.fields) {
          const newErrors: Record<string, string> = {};
          result.error.details.fields.forEach((field) => {
            newErrors[field.path] = field.message;
          });
          setInviteErrors(newErrors);
        } else {
          toast.error(result.error.message || 'Failed to send invitation');
        }
        return;
      }
      toast.success('Invitation sent!');
      setIsInviteModalOpen(false);
      setInviteEmail('');
      setInviteRole('Verifier');
    } catch {
      toast.error('Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (id: string) => {
    // Basic frontend safety
    if (members.find((m) => m.id === id)?.role.toLowerCase() === 'owner') {
      toast.error('Cannot remove the organization owner');
      return;
    }

    // Simulate server-side revocation
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setMembers((prev) => prev.filter((m) => m.id !== id));
      toast.success('Member removed');
    } catch {
      toast.error('Failed to remove member');
    }
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
        <div className="w-full md:w-2/3 flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              id="companyNameInput"
              type="text"
              value={localCompanyName}
              onChange={(e) => setLocalCompanyName(e.target.value)}
              aria-invalid={!!errors.companyName}
              className={`max-w-md w-full rounded-[var(--radius-control)] border ${
                errors.companyName ? 'border-red-500' : 'border-[var(--color-border)]'
              } px-3 py-2 text-[var(--color-fg)] bg-[var(--color-page)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-shadow`}
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
          {errors.companyName && <p className="text-red-500 text-sm">{errors.companyName}</p>}
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
            onClick={() => setIsInviteModalOpen(true)}
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
              {isLoadingMembers ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-sm text-[var(--color-fg-muted)]"
                  >
                    <Loader2 className="w-5 h-5 mx-auto animate-spin mb-2" />
                    Loading members...
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-sm text-[var(--color-fg-muted)]"
                  >
                    No members found.
                  </td>
                </tr>
              ) : (
                members.map((member) => {
                  const memberName = member.name;
                  const memberEmail = member.email;
                  const memberInitials = getInitials(member.name || '');
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
                            <p className="text-sm font-medium text-[var(--color-fg)]">
                              {memberName}
                            </p>
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
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-card)] shadow-lg w-full max-w-md overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
              <h3 className="text-lg font-semibold text-[var(--color-fg)]">Invite Member</h3>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-page)] p-1 rounded-md transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleInvite} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-[var(--color-fg)]" htmlFor="inviteEmail">
                  Email Address
                </label>
                <input
                  id="inviteEmail"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  aria-invalid={!!inviteErrors.email}
                  className={`w-full px-3 py-2 bg-[var(--color-page)] border ${
                    inviteErrors.email ? 'border-red-500' : 'border-[var(--color-border)]'
                  } rounded-[var(--radius-control)] text-sm text-[var(--color-fg)] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all`}
                  placeholder="colleague@company.com"
                />
                {inviteErrors.email && (
                  <p className="text-red-500 text-sm mt-1">{inviteErrors.email}</p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-[var(--color-fg)]" htmlFor="inviteRole">
                  Role
                </label>
                <select
                  id="inviteRole"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  aria-invalid={!!inviteErrors.role}
                  className={`w-full px-3 py-2 bg-[var(--color-page)] border ${
                    inviteErrors.role ? 'border-red-500' : 'border-[var(--color-border)]'
                  } rounded-[var(--radius-control)] text-sm text-[var(--color-fg)] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all`}
                >
                  <option value="Owner">Owner</option>
                  <option value="Verifier">Verifier</option>
                  <option value="Viewer">Viewer</option>
                </select>
                {inviteErrors.role && (
                  <p className="text-red-500 text-sm mt-1">{inviteErrors.role}</p>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  disabled={isInviting}
                  className="px-4 py-2 text-sm font-medium text-[var(--color-fg)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-control)] hover:bg-[var(--color-page)] disabled:opacity-70 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInviting}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-[var(--radius-control)] hover:bg-blue-700 disabled:opacity-70 shadow-sm transition-colors"
                >
                  {isInviting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {isInviting ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
