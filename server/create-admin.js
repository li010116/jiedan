import "dotenv/config";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { openDatabase } from "./db.js";
import { createAdmin } from "./auth.js";

const args = process.argv.slice(2);
const emailIndex = args.indexOf("--email");
const email = emailIndex >= 0 ? args[emailIndex + 1] : "admin@mogustack.local";
if (
  !email ||
  args.some((value, index) => value.startsWith("--") && value !== "--email")
)
  throw new Error("用法：npm run admin:create -- --email admin@example.com");
const db = openDatabase();
try {
  const password = randomBytes(24).toString("base64url");
  const folder = resolve(".local");
  const file = resolve(
    folder,
    existsSync(resolve(folder, "admin-credentials.txt"))
      ? `admin-credentials-${Date.now()}.txt`
      : "admin-credentials.txt",
  );
  mkdirSync(folder, { recursive: true });
  const user = await createAdmin(db, email, password);
  try {
    writeFileSync(
      file,
      `MOGUSTACK 管理后台\n\n邮箱：${user.email}\n密码：${password}\n\n登录：http://localhost:4173/admin\n此文件包含管理员凭据，请仅保留在本机，不要提交至版本库。\n`,
      { encoding: "utf8", mode: 0o600, flag: "wx" },
    );
  } catch (error) {
    db.prepare("DELETE FROM admins WHERE id=?").run(user.id);
    throw new Error(
      "无法写入本地凭据文件，管理员创建已撤回。请检查 .local 目录权限。",
    );
  }
  console.log(`管理员已创建：${user.email}\n登录凭据已保存到：${file}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  db.close();
}
