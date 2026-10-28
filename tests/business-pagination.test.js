import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { createAdmin } from '../server/auth.js';

test('business reads paginate and aggregate large datasets without losing filters, relationships or exports', async () => {
  const app = createApp({ databasePath: ':memory:', testMode: true });
  await createAdmin(app.locals.db, 'paging@example.com', 'test-password-only-42!');
  const db = app.locals.db;
  const now = new Date().toISOString();
  const insert = (table, data) => {
    const values = { ...data, created_at: now, updated_at: now };
    return Number(db.prepare(`INSERT INTO ${table} (${Object.keys(values).join(',')}) VALUES (${Object.keys(values).map(() => '?').join(',')})`).run(...Object.values(values)).lastInsertRowid);
  };
  db.exec('BEGIN');
  for (let n = 1; n <= 1000; n++) insert('clients', { name: `分页客户 ${n}`, contact: `paging-${n}@example.com`, company: '', status: n % 2 ? 'active' : 'prospect', notes: '', next_date: '' });
  const literal = insert('clients', { name: '=SUM(100%)_测试', contact: 'literal@example.com', company: '', status: 'archived', notes: '', next_date: '' });
  const project = insert('engagements', { client_id: 1, title: '独立项目', status: 'active', due_date: '', description: '项目范围' });
  for (let n = 1; n <= 1000; n++) insert('tasks', { engagement_id: project, title: `开发任务 ${n}`, status: n % 2 ? 'done' : 'todo', priority: 'normal', due_date: '2020-01-01', notes: '' });
  let quoteId;
  for (let n = 0; n < 7; n++) {
    const quote = insert('quotes', { engagement_id: project, title: `报价 ${n}`, status: 'accepted', valid_until: '', notes: '', items: JSON.stringify([{ title: '开发', quantity: 1, unit_cents: 10000 }]), amount_cents: 10000 });
    quoteId ??= quote;
    const contract = insert('contracts', { engagement_id: project, quote_id: quote, title: `合同 ${n}`, number: `PAGING-${n}`, amount_cents: 10000, status: n === 6 ? 'draft' : 'signed', signed_date: n === 6 ? '' : now.slice(0,10), due_date: '', notes: '' });
    if (n < 6) insert('payments', { contract_id: contract, title: `实收 ${n}`, amount_cents: 1000, status: 'received', due_date: '', paid_date: now.slice(0,10), method: '', notes: '', reference: '' });
  }
  db.exec('COMMIT');
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  let cookie = '';
  const call = async (path, body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/${path}`, {
      method: body ? 'POST' : 'GET', headers: { Origin: 'http://localhost:4173', Cookie: cookie, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, headers: response.headers, data: response.headers.get('content-type')?.includes('json') ? await response.json() : await response.text() };
  };
  try {
    for (const path of ['list/clients','dashboard','options/clients',`record/clients/1`,`project/${project}`,'export/clients']) assert.equal((await call(`admin/business/${path}`)).status,401);
    const login = await call('auth/login', { email: 'paging@example.com', password: 'test-password-only-42!' });
    cookie = login.headers.get('set-cookie').split(';')[0];
    const first = (await call('admin/business/list/clients')).data;
    assert.equal(first.total,1001); assert.equal(first.items.length,12); assert.equal(first.pages,84);
    assert.equal(first.items[0].id,literal); assert.equal(first.statusCounts.active,500);
    const second = (await call('admin/business/list/clients?page=2')).data;
    assert.equal(second.page,2); assert.ok(!first.items.some(a=>second.items.some(b=>a.id===b.id)));
    const last = (await call('admin/business/list/clients?page=999999')).data;
    assert.equal(last.page,84); assert.equal(last.items.length,5);
    const filtered = (await call('admin/business/list/clients?status=active&search=分页客户&limit=100')).data;
    assert.equal(filtered.total,500); assert.equal(filtered.items.length,100); assert.equal(filtered.statusCounts[''],1000);
    const wildcard = (await call(`admin/business/list/clients?search=${encodeURIComponent('100%)_')}`)).data;
    assert.equal(wildcard.total,1); assert.equal(wildcard.items[0].id,literal);
    for (const query of ['page=0','page=1.5','limit=101','limit=0','parent=-1','status=wrong','search=x&search=y','unexpected=1']) assert.equal((await call(`admin/business/list/tasks?${query}`)).status,400,query);
    assert.equal((await call('admin/business/list/unknown')).status,404);
    const options = (await call('admin/business/options/clients?selected=1')).data;
    assert.equal(options.items.length,30); assert.equal(options.selected.id,1); assert.equal(options.pages,34);
    const optionPage = (await call('admin/business/options/clients?page=2')).data;
    assert.equal(optionPage.page,2); assert.ok(!options.items.some(a=>optionPage.items.some(b=>a.id===b.id)));
    const optionSearch = (await call('admin/business/options/clients?search=100%25')).data;
    assert.equal(optionSearch.total,1);
    assert.equal((await call('admin/business/options/contracts?eligible=1')).data.total,6);
    const record = (await call(`admin/business/record/quotes/${quoteId}`)).data;
    assert.equal(record.item.locked,1); assert.ok(Array.isArray(record.item.items)); assert.equal(record.project.id,project); assert.equal(record.client.id,1);
    assert.equal((await call('admin/business/record/tasks/999999')).status,404);
    assert.equal((await call('admin/business/project/nope')).status,404);
    const overview = (await call(`admin/business/project/${project}`)).data.overview;
    assert.deepEqual(overview.counts,{ tasks:1000, quotes:7, contracts:7, payments:6 });
    assert.equal(overview.tasks.length,5); assert.equal(overview.quotes.length,4); assert.equal(overview.payments.length,4);
    assert.equal(overview.completedTasks,500); assert.equal(overview.effectiveContractsCount,6);
    assert.equal(overview.contracted,60000); assert.equal(overview.received,6000); assert.equal(overview.outstanding,54000);
    const contracts = (await call(`admin/business/list/contracts?status=outstanding&parent=${project}&project=${project}`)).data;
    assert.equal(contracts.total,6); assert.equal(contracts.context.project.id,project); assert.equal(contracts.statusCounts[''],7);
    const payments = (await call(`admin/business/list/payments?project=${project}`)).data;
    assert.equal(payments.total,6); assert.equal((await call(`admin/business/list/payments?project=999999`)).data.total,0);
    const tasks = (await call(`admin/business/list/tasks?parent=${project}&status=done`)).data;
    assert.equal(tasks.total,500); assert.equal(tasks.items.length,12);
    const dashboard = (await call('admin/business/dashboard')).data;
    assert.equal(dashboard.summary.contracted,60000); assert.equal(dashboard.summary.outstanding,54000); assert.equal(dashboard.summary.overdueTasks,500);
    assert.equal(dashboard.months.length,6); assert.equal(dashboard.months.at(-1).amount,6000); assert.equal(dashboard.reminders.length,8); assert.equal(dashboard.projects[0].task_total,1000); assert.equal(dashboard.projects[0].task_done,500);
    const csv = await call('admin/business/export/clients?search=分页客户&status=active&page=2');
    assert.equal(csv.status,200); assert.ok(csv.headers.get('content-disposition').includes('attachment'));
    assert.equal(csv.data.trim().split('\r\n').length,501); assert.ok(!csv.data.includes('archived'));
    assert.ok((await call(`admin/business/export/clients?search=${encodeURIComponent('100%)_')}`)).data.includes("'=SUM(100%)_测试"));
    const updated = await call('admin/business/clients', { name:'新增客户',contact:'new@example.com',company:'',status:'prospect',notes:'',next_date:'' });
    assert.equal(updated.status,201); assert.equal((await call('admin/business/list/clients')).data.total,1002);
  } finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); app.locals.closeDatabase(); }
});
