'use client';

import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';

export function ProfileTab() {
  const [isSaving, setIsSaving] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: 'Arun Kumar',
    email: 'admin@recheq.com'
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Image must be less than 2MB');
        return;
      }
      const objectUrl = URL.createObjectURL(file);
      setAvatar(objectUrl);
      toast.success('Avatar updated! Don\'t forget to save changes.');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    setIsSaving(false);
    toast.success('Profile updated successfully');
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
            <p className="text-xs text-[var(--color-fg-muted)] mt-1">This will be displayed on your profile.</p>
          </div>
          <div className="w-full md:w-2/3 flex items-center gap-4">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xl font-semibold text-white shadow-sm overflow-hidden border border-[var(--color-border)]">
              {avatar ? (
                <Image src={avatar} alt="Avatar" fill className="object-cover" />
              ) : (
                'AK'
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
            <label className="block text-sm font-medium text-[var(--color-fg)]">Full name</label>
          </div>
          <div className="w-full md:w-2/3">
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
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
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="max-w-md w-full rounded-[var(--radius-control)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-fg)] bg-[var(--color-page)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-shadow"
            />
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
