export interface EpfoContribution {
  /** YYYY-MM */
  month: string;
  employee_share: number;
  employer_share: number;
}

export interface EpfoPeriod {
  employerName: string;
  establishmentId: string;
  startDate: string;
  endDate: string | null;
  contributions: EpfoContribution[];
}

export interface EpfoHistory {
  uan: string;
  periods: EpfoPeriod[];
}

export interface EpfoProvider {
  fetchEmploymentHistory(uan: string, consentId: string): Promise<EpfoHistory | null>;
}
