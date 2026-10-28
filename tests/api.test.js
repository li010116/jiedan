import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join, resolve, sep, basename } from "node:path";
import { randomUUID } from "node:crypto";
import { createApp } from "../server/app.js";
import { createAdmin } from "../server/auth.js";

const origin = "http://localhost:4173";
const adminEmail = "test-admin@example.com";
const adminPassword = "test-only-password-42!";
const execFile = promisify(execFileCallback);
const validInquiry = () => ({
  service: "网站开发",
  name: "测试访客",
  contact: "test@example.com",
  budget: "5,000–15,000 元",
  description: "测试项目：需要响应式官网与作品管理功能。",
  website: "",
  idempotencyKey: randomUUID(),
});

async function cleanupTemp(folder) {
  const target = resolve(folder);
  if (
    !target.startsWith(resolve(tmpdir()) + sep) ||
    !basename(target).startsWith("mogustack-")
  )
    throw new Error("Refusing cleanup outside test temporary directory");
  await rm(target, { recursive: true, force: true });
}

async function start(options) {
  const app = createApp({
    testMode: true,
    publicOrigins: [origin],
    ...options,
  });
  const server = await new Promise((resolve) => {
    const value = app.listen(0, "127.0.0.1", () => resolve(value));
  });
  return {
    app,
    base: `http://127.0.0.1:${server.address().port}`,
    async close() {
      await new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      });
      app.locals.closeDatabase();
    },
  };
}

async function request(
  server,
  path,
  { method = "GET", body, cookie, requestOrigin = origin } = {},
) {
  const headers = {};
  if (requestOrigin !== null) headers.Origin = requestOrigin;
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(server.base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = raw;
  }
  return { status: response.status, headers: response.headers, data };
}

test("persistent inquiries, authenticated administration, validation and CSRF lifecycle", async () => {
  const folder = await mkdtemp(join(tmpdir(), "mogustack-api-"));
  const databasePath = join(folder, "app.sqlite");
  let server = await start({ databasePath });
  try {
    const user = await createAdmin(
      server.app.locals.db,
      adminEmail,
      adminPassword,
    );
    assert.equal(user.email, adminEmail);
    await assert.rejects(
      () =>
        createAdmin(server.app.locals.db, adminEmail, "another-valid-password"),
      /已存在/,
    );

    assert.equal((await request(server, "/api/health")).data.ok, true);
    const initial = await request(server, "/api/site");
    assert.equal(initial.status, 200);
    assert.equal(initial.data.projects.length, 3);
    assert.equal(initial.data.settings.studioName, "MOGUSTACK");
    assert.equal((await request(server, "/api/admin/inquiries")).status, 401);
    assert.deepEqual((await request(server, "/api/auth/session")).data, {
      user: null,
    });

    const wrongLogin = await request(server, "/api/auth/login", {
      method: "POST",
      body: { email: adminEmail, password: "incorrect" },
    });
    assert.equal(wrongLogin.status, 401);
    const foreignLogin = await request(server, "/api/auth/login", {
      method: "POST",
      body: { email: adminEmail, password: adminPassword },
      requestOrigin: "https://attacker.example",
    });
    assert.equal(foreignLogin.status, 403);
    const login = await request(server, "/api/auth/login", {
      method: "POST",
      body: { email: adminEmail, password: adminPassword },
    });
    assert.equal(login.status, 200);
    assert.deepEqual(login.data.user, { id: user.id, email: adminEmail });
    const cookieHeader = login.headers.get("set-cookie");
    assert.match(cookieHeader, /HttpOnly/);
    assert.match(cookieHeader, /SameSite=Strict/);
    assert.doesNotMatch(cookieHeader, /Secure/);
    const cookie = cookieHeader.split(";")[0];
    assert.equal(
      (await request(server, "/api/auth/session", { cookie })).data.user.email,
      adminEmail,
    );

    const invalid = await request(server, "/api/inquiries", {
      method: "POST",
      body: { ...validInquiry(), name: "   ", description: "x".repeat(3001) },
    });
    assert.equal(invalid.status, 400);
    assert.equal(
      (
        await request(server, "/api/inquiries", {
          method: "POST",
          body: { ...validInquiry(), service: "unsupported" },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request(server, "/api/inquiries", {
          method: "POST",
          body: { ...validInquiry(), website: "spam" },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request(server, "/api/inquiries", {
          method: "POST",
          body: validInquiry(),
          requestOrigin: "https://attacker.example",
        })
      ).status,
      403,
    );
    const payload = validInquiry();
    const submitted = await request(server, "/api/inquiries", {
      method: "POST",
      body: payload,
    });
    assert.equal(submitted.status, 201);
    assert.match(submitted.data.inquiry.reference, /^MG-\d{8}-[A-F0-9]{8}$/);
    assert.deepEqual(Object.keys(submitted.data.inquiry).sort(), [
      "createdAt",
      "id",
      "reference",
    ]);
    const repeated = await request(server, "/api/inquiries", {
      method: "POST",
      body: payload,
    });
    assert.equal(repeated.status, 200);
    assert.deepEqual(repeated.data, submitted.data);
    assert.equal(
      (
        await request(server, "/api/inquiries", {
          method: "POST",
          body: { ...payload, description: "修改后的内容" },
        })
      ).status,
      409,
    );

    const id = submitted.data.inquiry.id;
    assert.equal(
      (
        await request(server, `/api/admin/inquiries/${id}`, {
          method: "PATCH",
          body: { status: "contacted" },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await request(server, `/api/admin/inquiries/${id}`, {
          method: "PATCH",
          body: { status: "contacted" },
          cookie,
          requestOrigin: null,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(server, `/api/admin/inquiries/${id}`, {
          method: "PATCH",
          body: { status: "contacted" },
          cookie,
          requestOrigin: "https://attacker.example",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(server, `/api/admin/inquiries/${id}`, {
          method: "PATCH",
          body: { status: "invalid" },
          cookie,
        })
      ).status,
      400,
    );
    const updated = await request(server, `/api/admin/inquiries/${id}`, {
      method: "PATCH",
      body: { status: "in_progress", notes: "已确认范围，等待时间安排。" },
      cookie,
    });
    assert.equal(updated.data.inquiry.status, "in_progress");
    assert.equal(updated.data.inquiry.notes, "已确认范围，等待时间安排。");
    const list = await request(
      server,
      "/api/admin/inquiries?status=in_progress&q=测试&page=1&limit=10",
      { cookie },
    );
    assert.equal(list.data.total, 1);
    assert.equal(list.data.stats.in_progress, 1);
    assert.equal(list.data.items[0].contact, payload.contact);
    assert.equal(list.data.items[0].idempotencyKey, undefined);
    assert.equal(
      (await request(server, "/api/admin/inquiries?page=0", { cookie })).status,
      400,
    );

    const project = {
      title: "测试作品",
      category: "WEB APPLICATION",
      image: "/assets/work-dashboard.png",
      description: "测试说明",
      service: "网站开发",
      stack: ["React"],
      details: ["测试功能"],
      tone: "lilac",
      isDemo: false,
      sortOrder: 5,
      published: false,
    };
    assert.equal(
      (
        await request(server, "/api/admin/projects", {
          method: "POST",
          body: project,
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await request(server, "/api/admin/projects", {
          method: "POST",
          body: { ...project, image: "javascript:alert(1)" },
          cookie,
        })
      ).status,
      400,
    );
    const createdProject = await request(server, "/api/admin/projects", {
      method: "POST",
      body: project,
      cookie,
    });
    assert.equal(createdProject.status, 201);
    assert.equal(createdProject.data.project.previewUrl, "");
    for (const previewUrl of ["javascript:alert(1)", "data:text/html,test", "https://name:secret@example.com", "/relative-path"]) {
      assert.equal((await request(server, "/api/admin/projects", {
        method: "POST", body: { ...project, previewUrl }, cookie,
      })).status, 400);
    }
    assert.equal((await request(server, "/api/site")).data.projects.length, 3);
    const projectId = createdProject.data.project.id;
    assert.equal(
      (await request(server, "/api/admin/projects", { cookie })).data.projects
        .length,
      4,
    );
    const published = await request(
      server,
      `/api/admin/projects/${projectId}`,
      {
        method: "PUT",
        body: {
          ...project,
          published: true,
          image: "https://example.com/image.png",
          previewUrl: "https://example.com/demo?view=overview#start",
        },
        cookie,
      },
    );
    assert.equal(published.status, 200);
    assert.equal(published.data.project.previewUrl, "https://example.com/demo?view=overview#start");
    assert.equal((await request(server, "/api/site")).data.projects.find((item) => item.id === projectId).previewUrl, published.data.project.previewUrl);
    const cleared = await request(server, `/api/admin/projects/${projectId}`, {
      method: "PUT", body: { ...project, published: true, previewUrl: "" }, cookie,
    });
    assert.equal(cleared.data.project.previewUrl, "");
    assert.equal((await request(server, "/api/site")).data.projects.length, 4);
    assert.equal(
      (
        await request(server, `/api/admin/projects/${projectId}`, {
          method: "DELETE",
          cookie,
        })
      ).status,
      200,
    );
    const seedId = initial.data.projects[0].id;
    assert.equal(
      (
        await request(server, `/api/admin/projects/${seedId}`, {
          method: "DELETE",
          cookie,
        })
      ).status,
      200,
    );

    const settings = {
      ...initial.data.settings,
      email: "studio@example.com",
      wechat: "test_studio",
      tagline: "测试标语",
    };
    assert.equal(
      (
        await request(server, "/api/admin/settings", {
          method: "PUT",
          body: { ...settings, email: "invalid" },
          cookie,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request(server, "/api/admin/settings", {
          method: "PUT",
          body: settings,
          cookie,
        })
      ).status,
      200,
    );

    await server.close();
    server = await start({ databasePath });
    const persisted = await request(server, "/api/admin/inquiries", { cookie });
    assert.equal(persisted.status, 200, "sessions survive restart");
    assert.equal(persisted.data.total, 1);
    assert.equal(persisted.data.items[0].status, "in_progress");
    const persistedSite = await request(server, "/api/site");
    assert.equal(
      persistedSite.data.projects.length,
      2,
      "deleted seed projects must not be reinserted",
    );
    assert.equal(persistedSite.data.settings.email, "studio@example.com");
    assert.equal(
      (await request(server, "/api/auth/logout", { method: "POST", cookie }))
        .status,
      200,
    );
    assert.equal(
      (await request(server, "/api/admin/inquiries", { cookie })).status,
      401,
    );
    assert.deepEqual(
      (await request(server, "/api/auth/session", { cookie })).data,
      { user: null },
    );

    const browserWithoutOrigin = await fetch(server.base + "/api/inquiries", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Sec-Fetch-Site": "same-origin",
      },
      body: JSON.stringify(validInquiry()),
    });
    assert.equal(browserWithoutOrigin.status, 403);
    const crossSite = await fetch(server.base + "/api/inquiries", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        "Sec-Fetch-Site": "cross-site",
      },
      body: JSON.stringify(validInquiry()),
    });
    assert.equal(crossSite.status, 403);
  } finally {
    await server.close();
    await cleanupTemp(folder);
  }
});

test("production serves SPA, protects unknown API routes, and keeps allowed media CSP", async () => {
  const folder = await mkdtemp(join(tmpdir(), "mogustack-production-"));
  const dist = join(folder, "dist");
  await mkdir(dist);
  await writeFile(
    join(dist, "index.html"),
    "<!doctype html><h1>MOGUSTACK production</h1>",
  );
  const server = await start({
    databasePath: join(folder, "app.sqlite"),
    production: true,
    staticDirectory: dist,
    cookieSecure: true,
  });
  try {
    const response = await request(server, "/admin");
    assert.equal(response.status, 200);
    assert.match(response.data, /MOGUSTACK production/);
    const csp = response.headers.get("content-security-policy");
    assert.match(csp, /fonts.googleapis.com/);
    assert.match(csp, /fonts.gstatic.com/);
    assert.match(csp, /img-src 'self' https:/);
    assert.equal((await request(server, "/api/missing")).status, 404);
    assert.equal((await request(server, "/assets/missing.png")).status, 404);
    await createAdmin(server.app.locals.db, adminEmail, adminPassword);
    const login = await request(server, "/api/auth/login", {
      method: "POST",
      body: { email: adminEmail, password: adminPassword },
    });
    assert.match(login.headers.get("set-cookie"), /Secure/);
    server.app.locals.db.prepare("UPDATE sessions SET expires_at=0").run();
    assert.equal(
      (
        await request(server, "/api/auth/session", {
          cookie: login.headers.get("set-cookie").split(";")[0],
        })
      ).data.user,
      null,
    );
  } finally {
    await server.close();
    await cleanupTemp(folder);
  }
});

test("admin CLI creates private credentials without logging the password and backup is readable", async () => {
  const folder = await mkdtemp(join(tmpdir(), "mogustack-cli-"));
  const databasePath = join(folder, "app.sqlite");
  const env = { ...process.env, DATABASE_PATH: databasePath };
  const createScript = fileURLToPath(
    new URL("../server/create-admin.js", import.meta.url),
  );
  const backupScript = fileURLToPath(
    new URL("../server/backup.js", import.meta.url),
  );
  try {
    const result = await execFile(
      process.execPath,
      [createScript, "--email", adminEmail],
      { cwd: folder, env },
    );
    const credentials = await readFile(
      join(folder, ".local", "admin-credentials.txt"),
      "utf8",
    );
    const password = credentials.match(/密码：([^\n]+)/)[1].trim();
    assert.ok(password.length >= 24);
    assert.equal(result.stdout.includes(password), false);
    assert.equal(result.stderr.includes(password), false);
    await assert.rejects(() =>
      execFile(process.execPath, [createScript, "--email", adminEmail], {
        cwd: folder,
        env,
      }),
    );
    assert.equal(
      await readFile(join(folder, ".local", "admin-credentials.txt"), "utf8"),
      credentials,
    );
    const backupPath = join(folder, "backup.sqlite");
    await execFile(process.execPath, [backupScript, backupPath], {
      cwd: folder,
      env,
    });
    const db = new DatabaseSync(backupPath);
    try {
      assert.equal(
        db.prepare("SELECT email FROM admins").get().email,
        adminEmail,
      );
    } finally {
      db.close();
    }
  } finally {
    await cleanupTemp(folder);
  }
});

test("public submissions and failed logins are rate limited", async () => {
  const folder = await mkdtemp(join(tmpdir(), "mogustack-limit-"));
  const server = await start({
    databasePath: join(folder, "app.sqlite"),
    testMode: false,
  });
  try {
    for (let i = 0; i < 10; i++)
      assert.equal(
        (
          await request(server, "/api/inquiries", {
            method: "POST",
            body: validInquiry(),
          })
        ).status,
        201,
      );
    assert.equal(
      (
        await request(server, "/api/inquiries", {
          method: "POST",
          body: validInquiry(),
        })
      ).status,
      429,
    );
    for (let i = 0; i < 10; i++)
      assert.equal(
        (
          await request(server, "/api/auth/login", {
            method: "POST",
            body: { email: adminEmail, password: "bad-password" },
          })
        ).status,
        401,
      );
    assert.equal(
      (
        await request(server, "/api/auth/login", {
          method: "POST",
          body: { email: adminEmail, password: "bad-password" },
        })
      ).status,
      429,
    );
  } finally {
    await server.close();
    await cleanupTemp(folder);
  }
});
