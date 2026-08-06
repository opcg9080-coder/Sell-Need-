// ============================================================================
// db.js — ADMIN COPY. Intentionally duplicated from the user site's db.js so
// the two apps never import each other's code. They only share the same
// browser storage key (same origin) — that's how approvals reach the
// homepage. This file adds the admin-only operations.
// ============================================================================

const NS = "marketplace:v1";
const LATENCY = 150;
const delay = (v) => new Promise((res) => setTimeout(() => res(v), LATENCY));

function read() {
  const raw = localStorage.getItem(NS);
  if (raw) return JSON.parse(raw);
  const seeded = seed();
  localStorage.setItem(NS, JSON.stringify(seeded));
  return seeded;
}
function write(data) {
  localStorage.setItem(NS, JSON.stringify(data));
}
function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function nowISO() {
  return new Date().toISOString();
}

function seed() {
  const mk = (name, price, sellerName, contact, orderMethod, description, ageMinutes) => ({
    id: uid("item"),
    name, price, sellerName, contact, orderMethod, description,
    status: "approved",
    createdAt: new Date(Date.now() - ageMinutes * 60000).toISOString(),
    resolvedAt: new Date(Date.now() - (ageMinutes - 5) * 60000).toISOString(),
  });

  return {
    settings: {
      siteName: "Marketplace",
      currencySymbol: "₹",
      minPrice: 1,
      requireContact: true,
      updatedAt: nowISO(),
    },
    blockedContacts: [],
    auditLog: [],
    listings: [
      mk("Old bicycle in good condition", 150, "Ravi Kumar", "9876543210", "Meet nearby / cash on pickup", "Used but well maintained. Both tyres are new.", 60 * 24 * 2),
      mk("Wooden study chair", 50, "Anita Verma", "9123456780", "Pickup only", "Sturdy wooden chair, minor scratches on the leg.", 60 * 24 * 5),
      mk("Used novel collection (5 books)", 10, "Sana Iyer", "9988776655", "Courier available", "Assorted fiction novels, good condition.", 60 * 8),
      mk("Small buddha statue", 20, "Owen Park", "9012345678", "Meet nearby", "Decorative brass statue, about 6 inches tall.", 60 * 30),
    ],
  };
}

// ---------------------------------------------------------------------------
// Demo admin credentials — client-side only. Real protection needs a real
// backend; see README for how to upgrade this later.
// ---------------------------------------------------------------------------
const ADMIN_EMAIL = "kiposahi@gmail.com";
const ADMIN_PASSWORD = "bhootlodu0369";

export const auth = {
  async login(email, password) {
    if ((email || "").trim().toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      sessionStorage.setItem("marketplace:adminSession", "1");
      return delay({ ok: true });
    }
    return delay({ ok: false, error: "Incorrect email or password." });
  },
  isLoggedIn() {
    return sessionStorage.getItem("marketplace:adminSession") === "1";
  },
  logout() {
    sessionStorage.removeItem("marketplace:adminSession");
  },
};

function log(action, detail) {
  const d = read();
  d.auditLog.unshift({ id: uid("log"), action, detail, at: nowISO() });
  write(d);
}

export const listingsAdmin = {
  async stats() {
    const d = read();
    return delay({
      pending: d.listings.filter((l) => l.status === "pending").length,
      approved: d.listings.filter((l) => l.status === "approved").length,
      rejected: d.listings.filter((l) => l.status === "rejected").length,
    });
  },
  async list(status, query = "") {
    const d = read();
    const q = query.trim().toLowerCase();
    let items = d.listings.filter((l) => l.status === status);
    if (q) items = items.filter((l) => l.name.toLowerCase().includes(q) || (l.sellerName || "").toLowerCase().includes(q));
    return delay(items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  },
  async updateAndApprove(id, patch) {
    const d = read();
    const item = d.listings.find((l) => l.id === id);
    if (!item) throw new Error("Listing not found");
    Object.assign(item, patch, { status: "approved", resolvedAt: nowISO() });
    write(d);
    log("approve", `Approved "${item.name}"${patch && Object.keys(patch).length ? " (edited before approval)" : ""}`);
    return delay(item);
  },
  async reject(id, reason) {
    const d = read();
    const item = d.listings.find((l) => l.id === id);
    if (!item) throw new Error("Listing not found");
    item.status = "rejected";
    item.resolvedAt = nowISO();
    if (reason) item.rejectReason = reason;
    write(d);
    log("reject", `Rejected "${item.name}"${reason ? ` — ${reason}` : ""}`);
    return delay(item);
  },
  async bulkApprove(ids) {
    const d = read();
    ids.forEach((id) => {
      const item = d.listings.find((l) => l.id === id);
      if (item) { item.status = "approved"; item.resolvedAt = nowISO(); }
    });
    write(d);
    log("bulk_approve", `Bulk approved ${ids.length} listing(s)`);
    return delay(true);
  },
  async bulkReject(ids) {
    const d = read();
    ids.forEach((id) => {
      const item = d.listings.find((l) => l.id === id);
      if (item) { item.status = "rejected"; item.resolvedAt = nowISO(); }
    });
    write(d);
    log("bulk_reject", `Bulk rejected ${ids.length} listing(s)`);
    return delay(true);
  },
  async blockSeller(contact) {
    const d = read();
    const c = (contact || "").trim().toLowerCase();
    if (c && !d.blockedContacts.includes(c)) d.blockedContacts.push(c);
    write(d);
    log("block_seller", `Blocked contact "${contact}" from listing new items`);
    return delay(true);
  },
  async unblockSeller(contact) {
    const d = read();
    const c = (contact || "").trim().toLowerCase();
    d.blockedContacts = d.blockedContacts.filter((x) => x !== c);
    write(d);
    log("unblock_seller", `Unblocked contact "${contact}"`);
    return delay(true);
  },
  async blockedList() {
    const d = read();
    return delay([...d.blockedContacts]);
  },
};

export const settingsAdmin = {
  async get() {
    const d = read();
    return delay({ ...d.settings });
  },
  async update(patch) {
    const d = read();
    d.settings = { ...d.settings, ...patch, updatedAt: nowISO() };
    write(d);
    log("settings_update", `Updated settings: ${Object.keys(patch).join(", ")}`);
    return delay({ ...d.settings });
  },
  async exportCSV() {
    const d = read();
    const rows = [["Name", "Price", "Seller", "Status", "Contact", "Created"]];
    d.listings.forEach((l) => rows.push([l.name, l.price, l.sellerName, l.status, l.contact, l.createdAt]));
    return delay(rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n"));
  },
  async resetDemoData() {
    localStorage.removeItem(NS);
    return delay(true);
  },
};

export const auditLog = {
  async list() {
    const d = read();
    return delay([...d.auditLog]);
  },
};
