export interface EpfoPeriod {
  employerName: string;
  establishmentId: string;
  startDate: string;
  endDate: string | null;
}

export interface EpfoHistory {
  uan: string;
  periods: EpfoPeriod[];
}

export interface EpfoProvider {
  /**
   * Fetches employment history for a given UAN using the provided consent ID.
   * Returns null or a typed unavailable result if the UAN is not found/invalid.
   */
  fetchEmploymentHistory(uan: string, consentId: string): Promise<EpfoHistory | null>;
}
