import { readFileSync } from 'node:fs';
import { verifyChain } from '../services/api/src/audit/verify-chain.js';

// Standalone CLI script to verify an audit chain exported as JSON
const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error('Usage: pnpm tsx scripts/verify-audit-chain.ts <path-to-events.json>');
  process.exit(1);
}

try {
  const fileContent = readFileSync(args[0], 'utf-8');
  const events = JSON.parse(fileContent);
  
  if (!Array.isArray(events)) {
    throw new Error('Expected JSON file to contain an array of events.');
  }

  verifyChain(events);
  console.log('✅ Audit chain verified successfully. No tampering detected.');
  process.exit(0);
} catch (err: unknown) {
  console.error('❌ Audit chain verification failed!');
  if (err instanceof Error) {
    console.error(err.message);
    if ('eventId' in err && err.eventId) {
      console.error(`Tampered Event ID: ${err.eventId}`);
    }
  } else {
    console.error(err);
  }
  process.exit(1);
}
