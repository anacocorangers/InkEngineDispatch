import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { getPostgresOptions, getPostgresUrl } from './repository.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required to run migrations.')

const client = postgres(getPostgresUrl(databaseUrl), { ...getPostgresOptions(databaseUrl), max: 1 })
const database = drizzle(client)
const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), '../../drizzle')

try {
  await migrate(database, { migrationsFolder })
  console.log('Database migrations completed.')
}
finally {
  await client.end()
}