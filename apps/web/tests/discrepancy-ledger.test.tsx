// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { expect, test, describe, afterEach } from 'vitest';
import { DiscrepancyLedger } from '../src/components/ledger/DiscrepancyLedger';
import type { FindingRecord } from '@tieout/schema';

afterEach(() => {
  cleanup();
});

describe('DiscrepancyLedger', () => {
  const mockFindings: FindingRecord[] = [
    {
      id: 'finding-1',
      case_id: 'case-001',
      rule_id: 'CHK-PAYSLIP-ARITH',
      severity: 'high',
      status: 'open',
      title: 'Payslip Arithmetic Mismatch',
      explanation: 'The sum of all earnings and deductions does not match the stated net pay.',
      expected: '85000',
      observed: '92000',
      source_document_ids: ['doc-1'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'finding-2',
      case_id: 'case-001',
      rule_id: 'CHK-CTC-PLAUSIBLE',
      severity: 'medium',
      status: 'open',
      title: 'CTC Implausible',
      explanation:
        'The annualized gross salary derived from the payslip deviates significantly from the claimed CTC.',
      expected: null,
      observed: null,
      source_document_ids: ['doc-1'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const mockNotAssessed = ['CHK-PF-IMPLIES-BASIC'];

  test('renders the correct risk score breakdown', () => {
    render(
      <DiscrepancyLedger findings={mockFindings} notAssessed={mockNotAssessed} riskScore={55} />,
    );

    expect(screen.getByText('55')).toBeInTheDocument();
    expect(screen.getByText(/Arithmetic Breakdown/i)).toBeInTheDocument();
  });

  test('renders findings with proper titles and severity', () => {
    render(
      <DiscrepancyLedger findings={mockFindings} notAssessed={mockNotAssessed} riskScore={55} />,
    );

    expect(screen.getByText('Payslip Arithmetic Mismatch')).toBeInTheDocument();
    expect(screen.getByText('CTC Implausible')).toBeInTheDocument();

    // Sort logic should put High severity first
    const headings = screen.getAllByRole('heading', { level: 3 });
    // first heading is Risk Score, second is Payslip, third is CTC, fourth is Not Assessed
    expect(headings[1]).toHaveTextContent('Payslip Arithmetic Mismatch');
  });

  test('renders expected and observed values when present', () => {
    render(
      <DiscrepancyLedger findings={mockFindings} notAssessed={mockNotAssessed} riskScore={55} />,
    );

    expect(screen.getByText('85000')).toBeInTheDocument();
    expect(screen.getByText('92000')).toBeInTheDocument();
  });

  test('renders not assessed list properly', () => {
    render(
      <DiscrepancyLedger findings={mockFindings} notAssessed={mockNotAssessed} riskScore={55} />,
    );

    expect(screen.getByText(/Not Assessed/i)).toBeInTheDocument();
    expect(screen.getByText('CHK-PF-IMPLIES-BASIC')).toBeInTheDocument();
  });
});
