'use client';

import React, { useState } from 'react';
import { CaseEditModal } from './CaseEditModal';
import type { CaseRecord } from '@recheq/schema';
import { Edit2 } from 'lucide-react';

export function EditCaseButton({ caseRecord }: { caseRecord: CaseRecord }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[var(--color-fg)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md hover:bg-[var(--color-page)] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-accent)] shadow-sm"
      >
        <Edit2 className="w-4 h-4" />
        Edit Details
      </button>

      {isOpen && <CaseEditModal caseRecord={caseRecord} onClose={() => setIsOpen(false)} />}
    </>
  );
}
