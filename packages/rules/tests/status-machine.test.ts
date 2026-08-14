import { describe, it, expect } from 'vitest';
import { transition, canTransition, validEventsFor } from '../src/status-machine.js';
import type { TransitionEvent } from '../src/status-machine.js';
import type { CaseStatus } from '@tieout/schema';

describe('status-machine: transition()', () => {
  // ─── Happy path transitions ───────────────────────────────────

  const validTransitions: Array<[CaseStatus, TransitionEvent, CaseStatus]> = [
    ['draft', 'invite_sent', 'awaiting_consent'],
    ['awaiting_consent', 'consent_granted', 'awaiting_documents'],
    ['awaiting_documents', 'documents_submitted', 'processing'],
    ['processing', 'processing_complete', 'complete'],
    ['processing', 'employer_request_sent', 'awaiting_employer'],
    ['awaiting_employer', 'employer_responded', 'processing'],
    ['awaiting_employer', 'processing_complete', 'complete'],
    ['complete', 'processing_started', 'processing'],
  ];

  for (const [from, event, expected] of validTransitions) {
    it(`${from} + ${event} → ${expected}`, () => {
      const result = transition(from, event);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.status).toBe(expected);
      }
    });
  }

  // ─── Withdrawn transitions ──────────────────────────────────

  const withdrawableStates: CaseStatus[] = [
    'awaiting_consent',
    'awaiting_documents',
    'processing',
    'awaiting_employer',
  ];

  for (const from of withdrawableStates) {
    it(`${from} + withdrawn → withdrawn`, () => {
      const result = transition(from, 'withdrawn');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.status).toBe('withdrawn');
      }
    });
  }

  // ─── Withdrawn is NOT available from draft, complete, or withdrawn ─

  it('draft cannot be withdrawn', () => {
    const result = transition('draft', 'withdrawn');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_TRANSITION');
    }
  });

  it('complete cannot be withdrawn', () => {
    const result = transition('complete', 'withdrawn');
    expect(result.ok).toBe(false);
  });

  it('withdrawn cannot be withdrawn again', () => {
    const result = transition('withdrawn', 'withdrawn');
    expect(result.ok).toBe(false);
  });

  // ─── Invalid transitions return typed error ─────────────────

  it('draft + consent_granted is invalid', () => {
    const result = transition('draft', 'consent_granted');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_TRANSITION');
      expect(result.error.from).toBe('draft');
      expect(result.error.event).toBe('consent_granted');
      expect(result.error.message).toContain('draft');
    }
  });

  it('awaiting_consent + documents_submitted is invalid', () => {
    const result = transition('awaiting_consent', 'documents_submitted');
    expect(result.ok).toBe(false);
  });

  it('withdrawn is terminal — no event works', () => {
    const events: TransitionEvent[] = [
      'invite_sent',
      'consent_granted',
      'documents_submitted',
      'processing_started',
      'processing_complete',
      'employer_request_sent',
      'employer_responded',
      'withdrawn',
    ];
    for (const event of events) {
      const result = transition('withdrawn', event);
      expect(result.ok).toBe(false);
    }
  });
});

describe('status-machine: canTransition()', () => {
  it('returns true for valid transitions', () => {
    expect(canTransition('draft', 'invite_sent')).toBe(true);
    expect(canTransition('processing', 'withdrawn')).toBe(true);
  });

  it('returns false for invalid transitions', () => {
    expect(canTransition('draft', 'consent_granted')).toBe(false);
    expect(canTransition('withdrawn', 'invite_sent')).toBe(false);
  });
});

describe('status-machine: validEventsFor()', () => {
  it('returns correct events for draft', () => {
    expect(validEventsFor('draft')).toEqual(['invite_sent']);
  });

  it('returns empty array for withdrawn (terminal)', () => {
    expect(validEventsFor('withdrawn')).toEqual([]);
  });

  it('includes withdrawn for awaiting_consent', () => {
    const events = validEventsFor('awaiting_consent');
    expect(events).toContain('consent_granted');
    expect(events).toContain('withdrawn');
  });
});
