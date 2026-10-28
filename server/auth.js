import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE = "mogustack_session";
export const SESSION_TTL = 8 * 60 * 60 * 1000;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password, storedHash) {
  const [algorithm, salt, digest] = (storedHash || "").split(":");
  if (algorithm !== "scrypt" || !salt || !digest) return false;
  const actual = await scrypt(password, salt, 64);
  const expected = Buffer.from(digest, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

export function tokenHash(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function readSessionToken(req) {
  const entry = (req.headers.cookie || "")
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${SESSION_COOKIE}=`));
  const value = entry?.slice(SESSION_COOKIE.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}

export function getSessionUser(db, req) {
  const token = readSessionToken(req);
  if (!token) return null;
  const user = db
    .prepare(
      "SELECT admins.id, admins.email FROM sessions JOIN admins ON admins.id=sessions.admin_id WHERE sessions.token_hash=? AND sessions.expires_at>?",
    )
    .get(tokenHash(token), Date.now());
  return user ? { id: user.id, email: user.email } : null;
}

export function sessionCookieOptions(production = false) {
  return {
    httpOnly: true,
    sameSite: "strict",
    secure: production,
    path: "/",
    maxAge: SESSION_TTL,
  };
}

export function startSession(db, req, res, userId, production) {
  const oldToken = readSessionToken(req);
  if (oldToken)
    db.prepare("DELETE FROM sessions WHERE token_hash=?").run(
      tokenHash(oldToken),
    );
  db.prepare("DELETE FROM sessions WHERE expires_at<=?").run(Date.now());
  const token = randomBytes(32).toString("hex");
  db.prepare(
    "INSERT INTO sessions (token_hash,admin_id,expires_at) VALUES (?,?,?)",
  ).run(tokenHash(token), userId, Date.now() + SESSION_TTL);
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions(production));
}

export async function createAdmin(db, email, password) {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254)
    throw new Error("请输入有效的管理员邮箱。");
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 128
  )
    throw new Error("管理员密码须为 12–128 个字符。");
  if (db.prepare("SELECT id FROM admins WHERE email=?").get(normalized))
    throw new Error("该管理员已存在，未覆盖原账号。");
  const result = db
    .prepare(
      "INSERT INTO admins (email,password_hash,created_at) VALUES (?,?,?)",
    )
    .run(normalized, await hashPassword(password), new Date().toISOString());
  return { id: Number(result.lastInsertRowid), email: normalized };
}
