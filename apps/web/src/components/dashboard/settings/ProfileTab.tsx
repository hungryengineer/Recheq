'use client';

import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useUser } from '@/contexts/UserContext';
import { updateProfileAction } from '@/lib/api/settings';

export function ProfileTab() {
  const [isSaving, setIsSaving] = useState(false);
  const { avatar, setAvatar, name, setName, email, setEmail } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local state for the form so it doesn't update the nav bar until you click Save
  const [formData, setFormData] = useState<{ name: string; email: string; avatar?: string }>({
    name: name,
    email: email,
    avatar: avatar || undefined,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Image must be less than 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setFormData((prev) => ({ ...prev, avatar: base64 }));
        setAvatar(base64);
        toast.success("Avatar preview ready! Don't forget to save changes.");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrors({});
    try {
      const result = await updateProfileAction(formData);
      if ('error' in result) {
        if (result.error.code === 'VALIDATION_ERROR' && result.error.details?.fields) {
          const newErrors: Record<string, string> = {};
          result.error.details.fields.forEach((field) => {
            newErrors[field.path] = field.message;
          });
          setErrors(newErrors);
        } else {
          toast.error(result.error.message || 'Failed to update profile');
        }
        return;
      }
      setName(formData.name);
      setEmail(formData.email);
      toast.success('Profile updated successfully');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
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
            <p className="text-xs text-[var(--color-fg-muted)] mt-1">
              This will be displayed on your profile.
            </p>
          </div>
          <div className="w-full md:w-2/3 flex items-center gap-4">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xl font-semibold text-white shadow-sm overflow-hidden border border-[var(--color-border)]">
              {avatar ? (
                <Image src={avatar} alt="Avatar" fill className="object-cover" />
              ) : (
                name
                  ?.split(' ')
                  .map((n) => n[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase() || '?'
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarChange}
              accept="image/png, image/jpeg, image/webp"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 text-sm font-medium text-[var(--color-fg)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-control)] shadow-sm hover:bg-[var(--color-page)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-1 active:scale-95 transition-all"
            >
              Change avatar
            </button>
          </div>
        </div>

        <hr className="border-[var(--color-border)]" />

        <div className="flex flex-col md:flex-row md:items-start gap-4">
          <div className="w-full md:w-1/3">
            <label
              htmlFor="fullNameInput"
              className="block text-sm font-medium text-[var(--color-fg)]"
            >
              Full name
            </label>
          </div>
          <div className="w-full md:w-2/3">
            <input
              id="fullNameInput"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              aria-invalid={!!errors.name}
              className={`max-w-md w-full rounded-[var(--radius-control)] border ${
                errors.name ? 'border-red-500' : 'border-[var(--color-border)]'
              } px-3 py-2 text-[var(--color-fg)] bg-[var(--color-page)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-shadow`}
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-start gap-4">
          <div className="w-full md:w-1/3">
            <label
              htmlFor="emailAddressInput"
              className="block text-sm font-medium text-[var(--color-fg)]"
            >
              Email address
            </label>
          </div>
          <div className="w-full md:w-2/3">
            <input
              id="emailAddressInput"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              aria-invalid={!!errors.email}
              className={`max-w-md w-full rounded-[var(--radius-control)] border ${
                errors.email ? 'border-red-500' : 'border-[var(--color-border)]'
              } px-3 py-2 text-[var(--color-fg)] bg-[var(--color-page)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-shadow`}
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
          </div>
        </div>
      </div>

      <div className="pt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-[var(--color-surface)] bg-[var(--color-fg)] rounded-[var(--radius-control)] shadow-sm hover:opacity-90 disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-1 active:scale-95 transition-all"
        >
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          {isSaving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
