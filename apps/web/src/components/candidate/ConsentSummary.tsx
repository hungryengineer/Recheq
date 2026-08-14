export function ConsentSummary({ orgName }: { orgName: string }) {
  return (
    <div className="card mt-6">
      <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Data Processing Disclosure</h2>
      
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1rem', color: 'var(--color-primary)' }}>1. What we collect</h3>
        <p className="text-muted mt-1" style={{ fontSize: '0.9rem' }}>
          We will request you to upload your <strong>Payslips</strong> and <strong>Form 16</strong>. We may also request your UAN to check your EPFO records.
        </p>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1rem', color: 'var(--color-primary)' }}>2. Why we collect it</h3>
        <p className="text-muted mt-1" style={{ fontSize: '0.9rem' }}>
          {orgName} uses this information strictly to verify your past employment and compensation history to complete your background check.
        </p>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1rem', color: 'var(--color-primary)' }}>3. Retention & Privacy</h3>
        <p className="text-muted mt-1" style={{ fontSize: '0.9rem' }}>
          Your documents are securely processed and are automatically deleted upon completion of the verification process. We do not sell or share your data with unauthorized third parties.
        </p>
      </div>

      <div>
        <h3 style={{ fontSize: '1rem', color: 'var(--color-primary)' }}>4. Withdrawal</h3>
        <p className="text-muted mt-1" style={{ fontSize: '0.9rem' }}>
          You can withdraw your consent at any time during the process. If you withdraw, your documents will be deleted, and the employer will be notified of your withdrawal.
        </p>
      </div>
    </div>
  );
}
