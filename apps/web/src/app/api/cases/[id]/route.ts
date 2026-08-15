import { NextResponse } from 'next/server';
import { mockCases } from '../route';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const caseRecord = mockCases.find((c) => c.id === id);

  if (!caseRecord) {
    return NextResponse.json({ message: 'Case not found' }, { status: 404 });
  }

  const mockFindings =
    id === 'case-001'
      ? [
          {
            id: 'finding-1',
            case_id: 'case-001',
            rule_id: 'CHK-PAYSLIP-ARITH',
            severity: 'high',
            status: 'open',
            title: 'Payslip Arithmetic Mismatch',
            explanation:
              'The sum of all earnings and deductions does not match the stated net pay.',
            expected: '85000',
            observed: '92000',
            source_document_ids: ['doc-1'],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]
      : [];

  return NextResponse.json({
    caseRecord,
    findings: mockFindings,
    notAssessed: id === 'case-001' ? ['CHK-PF-IMPLIES-BASIC'] : [],
  });
}
