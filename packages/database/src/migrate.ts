import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { StatusDatabase } from "./index.js";

const path = process.env.DATABASE_URL?.replace(/^file:/, "") ?? "./data/status.db";
mkdirSync(dirname(path), { recursive: true });
const database = new StatusDatabase(path);
console.log(database.isReady() ? `Database migration complete (schema version ${database.getSchemaVersion()}).` : "Database migration failed.");
database.close();
