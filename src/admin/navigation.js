export const sections = ["dashboard", "inquiries", "clients", "engagements", "tasks", "quotes", "contracts", "payments", "projects", "settings"];
const keys = ["status", "parent", "search", "page", "record", "create", "project"];
export function readAdminRoute(hash) {
  const [name, query = ""] = hash.replace(/^#\/?/, "").split("?");
  const params = new URLSearchParams(query);
  const route = { section: sections.includes(name) ? name : "dashboard" };
  for (const key of keys) {
    const value = params.get(key);
    if (!value) continue;
    if (["parent", "page", "record", "project"].includes(key) && !/^[1-9]\d{0,9}$/.test(value)) continue;
    route[key] = value.slice(0, 500);
  }
  return route;
}
export function adminHash(section, params = {}) {
  const query = new URLSearchParams();
  for (const key of keys) if (params[key] != null && params[key] !== "" && !(key === "page" && Number(params[key]) === 1)) query.set(key, String(params[key]));
  return `#${sections.includes(section) ? section : "dashboard"}${query.size ? `?${query}` : ""}`;
}
export const effectiveContract = contract => ["signed", "completed"].includes(contract.status);
export function contractBalance(contract, payments) {
  return effectiveContract(contract) ? contract.amount_cents - payments.filter(p => p.contract_id === contract.id && p.status === "received").reduce((sum, p) => sum + p.amount_cents, 0) : 0;
}
export function statusMatches(section, item, status, data) {
  if (!status) return true;
  if (section === "engagements" && status === "open") return ["planning", "active", "review"].includes(item.status);
  if (section === "contracts" && status === "effective") return effectiveContract(item);
  if (section === "contracts" && status === "outstanding") return contractBalance(item, data.payments) > 0;
  return item.status === status;
}
export function projectOverview(data, id) {
  const project = data.engagements.find(item => item.id === Number(id));
  if (!project) return null;
  const contracts = data.contracts.filter(item => item.engagement_id === project.id);
  const contractIds = new Set(contracts.map(item => item.id));
  const payments = data.payments.filter(item => contractIds.has(item.contract_id));
  const tasks = data.tasks.filter(item => item.engagement_id === project.id);
  const contracted = contracts.filter(effectiveContract).reduce((sum, item) => sum + item.amount_cents, 0);
  const received = payments.filter(item => item.status === "received").reduce((sum, item) => sum + item.amount_cents, 0);
  return { project, client: data.clients.find(item => item.id === project.client_id), tasks, quotes: data.quotes.filter(item => item.engagement_id === project.id), contracts, payments, contracted, received, outstanding: contracted - received, completedTasks: tasks.filter(item => item.status === "done").length };
}
