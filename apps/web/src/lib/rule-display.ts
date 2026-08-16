const ruleTitles: Record<string, string> = {
  'payslip-arithmetic': 'Payslip Arithmetic Mismatch',
  'payslip-arithmetic-gross': 'Gross Pay Calculation Error',
  'payslip-arithmetic-net': 'Net Pay Calculation Error',
  'pf-implies-basic': 'PF deduction inconsistent with declared basic',
  'pf-matches-epfo': 'Payslip PF does not match the EPFO filing',
  'dual-employment': 'Potential Dual Employment Detected',
  'dates-within-epfo-period': 'Employment Dates Not Covered by EPFO',
  'form16-reconciles-payslip': 'Form 16 Does Not Reconcile With Payslip',
  'employer-name-match': 'Employer Name Mismatch',
  'identity-consistent': 'Candidate Identity Inconsistent Across Documents',
  'ctc-plausible': 'Claimed CTC Implausible Based on Evidence',
  'epfo-gap-analysis': 'Unexplained Gap in EPFO Contributions',
  'forensics-metadata': 'Document Metadata Anomalies',
  'forensics-font-anomalies': 'Multiple Fonts/Sizes Detected in Same Text Block',
  'forensics-monetary-anomalies': 'Monetary Values Show Signs of Tampering',
};

export function getFriendlyRuleTitle(ruleId: string): string {
  const normalizedId = ruleId.toLowerCase().replace('chk-', '');
  return ruleTitles[normalizedId] || normalizedId;
}
