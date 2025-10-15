import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL || process.argv[2];
  if (!url) {
    console.error('DATABASE_URL not provided. Pass as env or first arg.');
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });
  try {
    const users = await sql<{
      id: string;
      email: string | null;
      created_at: string | null;
    }[]>`select id, email, created_at from users order by created_at asc nulls last`;

    const emails = users.map(u => u.email).filter((e): e is string => !!e);
    console.log(`Total users: ${users.length}`);
    console.log('Emails:');
    emails.forEach(e => console.log(e));
  } catch (err) {
    console.error('Query failed:', err);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

main();


