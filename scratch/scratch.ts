import postgres from 'postgres';

async function checkJobs() {
  const sql = postgres(process.env.DATABASE_URL!);
  const jobs = await sql`SELECT * FROM pgboss.job WHERE name = 'email_delivery' ORDER BY created_on DESC LIMIT 5`;
  console.log('Recent jobs:', jobs);
  sql.end();
}

checkJobs();
