import "dotenv/config";
import { createApp } from "./app.js";

const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || "127.0.0.1";
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT 须为有效端口。");
const production = process.env.NODE_ENV === "production";
const publicOrigins = process.env.PUBLIC_ORIGIN
  ? process.env.PUBLIC_ORIGIN.split(",")
      .map((v) => v.trim())
      .filter(Boolean)
  : production
    ? [`http://localhost:${port}`]
    : [
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        `http://localhost:${port}`,
        `http://127.0.0.1:${port}`,
      ];
const nonLocalHttp = publicOrigins.some((value) => {
  const url = new URL(value);
  return (
    url.protocol === "http:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  );
});
if (production && nonLocalHttp)
  throw new Error("公网生产环境的 PUBLIC_ORIGIN 必须使用 HTTPS。");
const cookieSecure =
  process.env.COOKIE_SECURE === undefined
    ? publicOrigins.some((value) => value.startsWith("https:"))
    : process.env.COOKIE_SECURE === "true";
if (
  production &&
  !cookieSecure &&
  publicOrigins.some((value) => {
    const url = new URL(value);
    return !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  })
)
  throw new Error("公网生产环境不能关闭安全 Cookie。");
const trustProxy = process.env.TRUST_PROXY
  ? Number(process.env.TRUST_PROXY)
  : undefined;
if (
  trustProxy !== undefined &&
  (!Number.isInteger(trustProxy) || trustProxy < 0 || trustProxy > 5)
)
  throw new Error("TRUST_PROXY 须为 0–5 的可信代理层数。");
const app = createApp({ production, publicOrigins, cookieSecure, trustProxy });
const server = app.listen(port, host, () =>
  console.log(`MOGUSTACK API ready: http://${host}:${port}`),
);
function shutdown() {
  server.close(() => {
    app.locals.closeDatabase();
    process.exit(0);
  });
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
