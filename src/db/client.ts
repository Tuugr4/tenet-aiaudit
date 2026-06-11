import postgres from 'postgres';

export type Sql = postgres.Sql;

export function createDb(databaseUrl: string): Sql {
  return postgres(databaseUrl, {
    max: 10,
    onnotice: () => {},
    // Camel-case COLUMN names only. (transform: postgres.camel would also
    // rewrite keys inside JSONB values, corrupting stored API payloads.)
    transform: { column: { from: postgres.toCamel, to: postgres.fromCamel } },
  });
}
