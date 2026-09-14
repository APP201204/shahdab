import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { config } from "../config.ts";
import * as schema from "./schema.ts";

const client = new Client({
  connectionString: config.databaseUrl,
});

await client.connect();

export const db = drizzle(client, { schema });
