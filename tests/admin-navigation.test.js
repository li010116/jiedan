import test from "node:test";
import assert from "node:assert/strict";
import { readAdminRoute, adminHash, projectOverview, contractBalance, statusMatches } from "../src/admin/navigation.js";

test("admin routes preserve filters and record context, reject invalid identities", () => {
  const hash = adminHash("tasks", { parent: 7, project: 7, status: "doing", search: "页面 & API", page: 2, record: 9 });
  assert.deepEqual(readAdminRoute(hash), { section: "tasks", parent: "7", project: "7", status: "doing", search: "页面 & API", page: "2", record: "9" });
  assert.deepEqual(readAdminRoute("#unknown?parent=-1&page=NaN&record=0"), { section: "dashboard" });
  assert.equal(adminHash("payments", { status: "received", page: 1 }), "#payments?status=received");
});

test("project overview isolates relationships and uses signed contracts and actual receipts", () => {
  const data = {
    clients: [{ id: 4, name: "A" }], engagements: [{ id: 7, client_id: 4 }, { id: 8, client_id: 4 }],
    tasks: [{ id: 1, engagement_id: 7, status: "done" }, { id: 2, engagement_id: 7, status: "doing" }, { id: 3, engagement_id: 8, status: "done" }],
    quotes: [{ id: 1, engagement_id: 7 }, { id: 2, engagement_id: 8 }],
    contracts: [{ id: 1, engagement_id: 7, status: "signed", amount_cents: 10000 }, { id: 2, engagement_id: 7, status: "draft", amount_cents: 20000 }, { id: 3, engagement_id: 8, status: "signed", amount_cents: 30000 }],
    payments: [{ id: 1, contract_id: 1, status: "received", amount_cents: 2500 }, { id: 2, contract_id: 1, status: "pending", amount_cents: 3500 }, { id: 3, contract_id: 1, status: "void", amount_cents: 1000 }, { id: 4, contract_id: 3, status: "received", amount_cents: 30000 }],
  };
  const summary = projectOverview(data, "7");
  assert.equal(summary.client.name, "A");
  assert.equal(summary.tasks.length, 2);
  assert.equal(summary.completedTasks, 1);
  assert.equal(summary.quotes.length, 1);
  assert.equal(summary.payments.length, 3);
  assert.equal(summary.contracted, 10000);
  assert.equal(summary.received, 2500);
  assert.equal(summary.outstanding, 7500, "balance includes money without an explicit pending payment plan");
  assert.equal(contractBalance(data.contracts[1], data.payments), 0);
  assert.equal(statusMatches("contracts", data.contracts[0], "outstanding", data), true);
  assert.equal(statusMatches("contracts", data.contracts[1], "outstanding", data), false);
  assert.equal(statusMatches("contracts", data.contracts[2], "outstanding", data), false);
  assert.equal(statusMatches("engagements", { status: "review" }, "open", data), true);
  assert.equal(statusMatches("engagements", { status: "paused" }, "open", data), false);
  assert.equal(projectOverview(data, 99), null);
});
