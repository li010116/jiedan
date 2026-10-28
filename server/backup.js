import "dotenv/config";
import { mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { openDatabase } from "./db.js";

const target = resolve(
  process.argv[2] ||
    `backups/mogustack-${new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-")}.sqlite`,
);
if (existsSync(target)) throw new Error("备份目标已存在，未覆盖。");
mkdirSync(dirname(target), { recursive: true });
const db = openDatabase();
try {
  db.prepare("VACUUM INTO ?").run(target);
  console.log(`数据库备份已保存到：${target}`);
} finally {
  db.close();
}
