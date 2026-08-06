// ============================================================================
// admin.js — completely separate app from the user site. No shared UI, no
// shared login flow, no way to reach this from the public site.
// ============================================================================
import { icons } from "./icons.js";
import { auth, listingsAdmin, settingsAdmin, auditLog } from "./db.js";

const appEl = document.getElementById("app");
let currency = "₹";

function esc(s = "") {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function timeAgo(iso) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
function toast(title, tone = "ok") {
  const root = document.getElementById("toast-root");
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `${tone === "ok" ? icons.check : icons.x}<span>${esc(title)}</span>`;
  root.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .2s, transform .2s";
    el.style.opacity = "0"; el.style.transform = "translateX(14px)";
    setTimeout(() => el.remove(), 220);
  }, 3200);
}

let modalBackdrop = null;
function closeModal() { if (modalBackdrop) { modalBackdrop.remove(); modalBackdrop = null; } }
function openModal(title, bodyHTML, onMount) {
  closeModal();
  const el = document.createElement("div");
  el.className = "modal-backdrop";
  el.innerHTML = `
    <div class="modal-card">
      <div class="modal-head"><h3 style="font-size:17px;">${title}</h3><button class="modal-close" data-close>${icons.x}</button></div>
      <div>${bodyHTML}</div>
    </div>
  `;
  el.addEventListener("click", (e) => { if (e.target === el) closeModal(); });
  el.querySelector("[data-close]").addEventListener("click", closeModal);
  document.body.appendChild(el);
  modalBackdrop = el;
  if (onMount) onMount(el);
}

const NAV = [
  { path: "#/dashboard", label: "Dashboard", icon: "grid" },
  { path: "#/pending", label: "Pending Listings", icon: "clock", statKey: "pending" },
  { path: "#/approved", label: "Approved Listings", icon: "check" },
  { path: "#/rejected", label: "Rejected Listings", icon: "x" },
  { path: "#/audit", label: "Audit Log", icon: "history" },
  { path: "#/settings", label: "Settings", icon: "settings" },
];

async function shell(activePath) {
  const stats = await listingsAdmin.stats();
  appEl.innerHTML = `
    <div class="admin-shell">
      <aside class="sidebar">
        <div class="sidebar-brand">${icons.shield}<span>Admin Panel</span></div>
        <nav>
          ${NAV.map((n) => `
            <a href="${n.path}" class="side-link ${activePath === n.path ? "is-active" : ""}">
              ${icons[n.icon]}<span>${n.label}</span>
              ${n.statKey && stats[n.statKey] ? `<span class="side-badge">${stats[n.statKey]}</span>` : ""}
            </a>
          `).join("")}
        </nav>
        <div class="sidebar-footer">
          <button class="side-link" style="width:100%;background:none;border:none;text-align:left;" id="logoutBtn">${icons.logout}<span>Log out</span></button>
        </div>
      </aside>
      <main class="admin-main" id="mainContent"></main>
    </div>
  `;
  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    auth.logout();
    location.hash = "#/login";
  });
  return document.getElementById("mainContent");
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
function renderLogin() {
  appEl.innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <div class="login-mark">${icons.shield}</div>
        <h2 style="font-size:19px;">Admin Console</h2>
        <p style="color:var(--text-muted);font-size:13px;margin-top:6px;">Sign in to manage listings.</p>
        <form id="loginForm" style="text-align:left;margin-top:22px;">
          <div class="field"><label for="email">Email</label><input class="input" id="email" type="email" placeholder="admin@marketplace.local" required /></div>
          <div class="field"><label for="password">Password</label><input class="input" id="password" type="password" placeholder="••••••••" required /></div>
          <span class="help-text is-error" id="loginErr" style="display:block;margin-bottom:12px;"></span>
          <button type="submit" class="btn btn-primary btn-block">Login</button>
        </form>
      </div>
    </div>
  `;
  document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = document.getElementById("loginErr");
    err.textContent = "";
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    const res = await auth.login(document.getElementById("email").value, document.getElementById("password").value);
    btn.disabled = false;
    if (!res.ok) { err.textContent = res.error; return; }
    location.hash = "#/dashboard";
  });
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
async function renderDashboard() {
  const main = await shell("#/dashboard");
  const stats = await listingsAdmin.stats();
  main.innerHTML = `
    <div class="admin-head"><div><span class="eyebrow">Overview</span><h1 class="page-title">Dashboard</h1></div></div>
    <div class="grid grid-3">
      <div class="card stat-card"><span class="stat-icon stat-icon--amber">${icons.clock}</span><span class="stat-value">${stats.pending}</span><span class="stat-label">Pending Listings</span></div>
      <div class="card stat-card"><span class="stat-icon stat-icon--green">${icons.check}</span><span class="stat-value">${stats.approved}</span><span class="stat-label">Approved Listings</span></div>
      <div class="card stat-card"><span class="stat-icon stat-icon--red">${icons.x}</span><span class="stat-value">${stats.rejected}</span><span class="stat-label">Rejected Listings</span></div>
    </div>
    <div class="card card-pad" style="margin-top:20px;">
      <h3 style="font-size:15px;margin-bottom:10px;">Quick actions</h3>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <a href="#/pending" class="btn btn-primary">${icons.clock} Review pending</a>
        <a href="#/audit" class="btn btn-ghost">${icons.history} View audit log</a>
        <a href="#/settings" class="btn btn-ghost">${icons.settings} Settings</a>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Listing tables (pending / approved / rejected) — shared renderer
// ---------------------------------------------------------------------------
let searchQ = "";

async function renderListingTable(status, path, title) {
  const main = await shell(path);
  const items = await listingsAdmin.list(status, searchQ);

  main.innerHTML = `
    <div class="admin-head">
      <div><span class="eyebrow">Listings</span><h1 class="page-title">${title}</h1></div>
      ${status === "approved" ? `<button class="btn btn-ghost" id="exportBtn">${icons.download} Export CSV</button>` : ""}
    </div>

    <div class="toolbar">
      <div class="search-mini">${icons.search}<input id="searchInput" placeholder="Search by item or seller…" value="${esc(searchQ)}" /></div>
      ${status === "pending" ? `<button class="btn btn-green btn-sm" id="bulkApproveBtn" disabled>${icons.check} Approve selected</button>
      <button class="btn btn-red-ghost btn-sm" id="bulkRejectBtn" disabled>${icons.x} Reject selected</button>` : ""}
    </div>

    <div class="card">
      <div class="table-wrap">
        <table class="dtable">
          <thead><tr>
            ${status === "pending" ? `<th><input type="checkbox" id="selectAll" /></th>` : ""}
            <th>Item Name</th><th>Price</th><th>Seller</th><th>Submitted</th>${status === "pending" ? "<th></th>" : "<th>Status</th>"}
          </tr></thead>
          <tbody>
            ${items.length === 0 ? `<tr><td colspan="6"><div class="empty-state">${icons.clock}<h3>No listings here</h3></div></td></tr>` : items.map((it) => rowHTML(it, status)).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("searchInput")?.addEventListener("input", (e) => { searchQ = e.target.value; renderListingTable(status, path, title); });

  if (status === "approved") {
    document.getElementById("exportBtn")?.addEventListener("click", async () => {
      const csv = await settingsAdmin.exportCSV();
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "listings.csv"; a.click();
      URL.revokeObjectURL(url);
    });
  }

  if (status === "pending") {
    const selectAll = document.getElementById("selectAll");
    const approveBtn = document.getElementById("bulkApproveBtn");
    const rejectBtn = document.getElementById("bulkRejectBtn");
    const checkboxes = () => Array.from(main.querySelectorAll(".row-check"));

    function updateBulkButtons() {
      const checked = checkboxes().filter((c) => c.checked).length;
      approveBtn.disabled = checked === 0;
      rejectBtn.disabled = checked === 0;
    }
    selectAll?.addEventListener("change", () => { checkboxes().forEach((c) => (c.checked = selectAll.checked)); updateBulkButtons(); });
    checkboxes().forEach((c) => c.addEventListener("change", updateBulkButtons));

    approveBtn.addEventListener("click", async () => {
      const ids = checkboxes().filter((c) => c.checked).map((c) => c.dataset.id);
      await listingsAdmin.bulkApprove(ids);
      toast(`Approved ${ids.length} listing(s)`);
      renderListingTable(status, path, title);
    });
    rejectBtn.addEventListener("click", async () => {
      const ids = checkboxes().filter((c) => c.checked).map((c) => c.dataset.id);
      await listingsAdmin.bulkReject(ids);
      toast(`Rejected ${ids.length} listing(s)`, "err");
      renderListingTable(status, path, title);
    });

    main.querySelectorAll("[data-approve]").forEach((btn) => btn.addEventListener("click", () => openEditApproveModal(btn.dataset.approve, items, status, path, title)));
    main.querySelectorAll("[data-reject]").forEach((btn) => btn.addEventListener("click", () => openRejectModal(btn.dataset.reject, status, path, title)));
    main.querySelectorAll("[data-block]").forEach((btn) => btn.addEventListener("click", async () => {
      await listingsAdmin.blockSeller(btn.dataset.block);
      toast("Seller blocked from future listings", "err");
    }));
  }
}

function rowHTML(it, status) {
  if (status === "pending") {
    return `
      <tr>
        <td><input type="checkbox" class="row-check" data-id="${it.id}" /></td>
        <td><div style="font-weight:650;">${esc(it.name)}</div><div style="font-size:12px;color:var(--text-faint);">${esc(it.contact || "")}</div></td>
        <td class="price-cell">${currency}${it.price}</td>
        <td>${esc(it.sellerName)}</td>
        <td style="color:var(--text-muted);">${timeAgo(it.createdAt)}</td>
        <td>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn btn-green btn-sm" data-approve="${it.id}">${icons.check} Approve</button>
            <button class="btn btn-red-ghost btn-sm" data-reject="${it.id}">${icons.x} Reject</button>
            <button class="btn btn-ghost btn-sm" data-block="${it.contact}" title="Block this seller">${icons.ban}</button>
          </div>
        </td>
      </tr>
    `;
  }
  return `
    <tr>
      <td style="font-weight:650;">${esc(it.name)}</td>
      <td class="price-cell">${currency}${it.price}</td>
      <td>${esc(it.sellerName)}</td>
      <td style="color:var(--text-muted);">${timeAgo(it.createdAt)}</td>
      <td><span class="badge badge-${status}">${status[0].toUpperCase() + status.slice(1)}</span></td>
    </tr>
  `;
}

function openEditApproveModal(id, items, status, path, title) {
  const item = items.find((i) => i.id === id);
  if (!item) return;
  openModal("Review & approve listing", `
    <div class="field"><label>Item name</label><input class="input" id="editName" value="${esc(item.name)}" /></div>
    <div class="field"><label>Price (${currency})</label><input class="input" id="editPrice" type="number" value="${item.price}" /></div>
    <div class="field"><label>Description</label><textarea class="textarea" id="editDesc">${esc(item.description || "")}</textarea></div>
    <p class="help-text" style="margin-bottom:14px;">You can adjust details before approving. Changes will be reflected on the public listing.</p>
    <button class="btn btn-green btn-block" id="confirmApprove">${icons.check} Approve & Publish</button>
  `, (m) => {
    m.querySelector("#confirmApprove").addEventListener("click", async () => {
      await listingsAdmin.updateAndApprove(id, {
        name: m.querySelector("#editName").value.trim() || item.name,
        price: Number(m.querySelector("#editPrice").value) || item.price,
        description: m.querySelector("#editDesc").value.trim(),
      });
      closeModal();
      toast("Listing approved and published");
      renderListingTable(status, path, title);
    });
  });
}

function openRejectModal(id, status, path, title) {
  openModal("Reject listing", `
    <div class="field"><label>Reason (optional, internal only)</label><input class="input" id="rejReason" placeholder="e.g. Incomplete description" /></div>
    <button class="btn btn-red-ghost btn-block" id="confirmReject">${icons.x} Confirm rejection</button>
  `, (m) => {
    m.querySelector("#confirmReject").addEventListener("click", async () => {
      await listingsAdmin.reject(id, m.querySelector("#rejReason").value.trim());
      closeModal();
      toast("Listing rejected", "err");
      renderListingTable(status, path, title);
    });
  });
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------
async function renderAudit() {
  const main = await shell("#/audit");
  const logs = await auditLog.list();
  main.innerHTML = `
    <div class="admin-head"><div><span class="eyebrow">Accountability</span><h1 class="page-title">Audit Log</h1></div></div>
    <div class="card card-pad">
      ${logs.length === 0 ? `<div class="empty-state">${icons.history}<h3>No actions logged yet</h3><p>Every approve, reject, and settings change will appear here.</p></div>` : logs.map((l) => `
        <div class="log-item">
          <div class="log-dot"></div>
          <div><div>${esc(l.detail)}</div><div class="log-time">${timeAgo(l.at)}</div></div>
        </div>
      `).join("")}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
async function renderSettings() {
  const main = await shell("#/settings");
  const s = await settingsAdmin.get();
  const blocked = await listingsAdmin.blockedList();
  currency = s.currencySymbol;

  main.innerHTML = `
    <div class="admin-head"><div><span class="eyebrow">Configuration</span><h1 class="page-title">Settings</h1></div></div>

    <div class="grid grid-2">
      <div class="card card-pad">
        <h3 style="font-size:15px;margin-bottom:16px;">General</h3>
        <div class="field"><label>Site name</label><input class="input" id="siteName" value="${esc(s.siteName)}" /></div>
        <div class="field"><label>Currency symbol</label><input class="input" id="currencySymbol" value="${esc(s.currencySymbol)}" /></div>
        <div class="field"><label>Minimum listing price</label><input class="input" id="minPrice" type="number" value="${s.minPrice}" /></div>
        <div class="settings-row">
          <div><div class="title">Require contact method</div><div class="sub">Sellers must provide a way to be reached</div></div>
          <button class="toggle ${s.requireContact ? "is-on" : ""}" id="requireContactToggle"></button>
        </div>
        <button class="btn btn-primary btn-block" id="saveSettingsBtn" style="margin-top:16px;">${icons.check} Save settings</button>
      </div>

      <div class="card card-pad">
        <h3 style="font-size:15px;margin-bottom:6px;">Blocked sellers</h3>
        <p class="help-text" style="margin-bottom:14px;">These contact methods can't submit new listings.</p>
        ${blocked.length === 0 ? `<p class="help-text">No sellers blocked.</p>` : blocked.map((c) => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border);font-size:13px;">
            <span>${esc(c)}</span>
            <button class="btn btn-ghost btn-sm" data-unblock="${esc(c)}">Unblock</button>
          </div>
        `).join("")}

        <h3 style="font-size:15px;margin:22px 0 6px;">Data</h3>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-ghost btn-sm" id="exportAllBtn">${icons.download} Export all listings (CSV)</button>
        </div>
      </div>
    </div>
  `;

  const toggle = document.getElementById("requireContactToggle");
  let requireContact = s.requireContact;
  toggle.addEventListener("click", () => { requireContact = !requireContact; toggle.classList.toggle("is-on", requireContact); });

  document.getElementById("saveSettingsBtn")?.addEventListener("click", async () => {
    await settingsAdmin.update({
      siteName: document.getElementById("siteName").value.trim() || s.siteName,
      currencySymbol: document.getElementById("currencySymbol").value.trim() || s.currencySymbol,
      minPrice: Number(document.getElementById("minPrice").value) || s.minPrice,
      requireContact,
    });
    toast("Settings saved");
    renderSettings();
  });

  main.querySelectorAll("[data-unblock]").forEach((btn) => btn.addEventListener("click", async () => {
    await listingsAdmin.unblockSeller(btn.dataset.unblock);
    toast("Seller unblocked");
    renderSettings();
  }));

  document.getElementById("exportAllBtn")?.addEventListener("click", async () => {
    const csv = await settingsAdmin.exportCSV();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "all-listings.csv"; a.click();
    URL.revokeObjectURL(url);
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
async function router() {
  const path = location.hash || "#/login";

  if (!auth.isLoggedIn()) {
    if (path !== "#/login") { location.hash = "#/login"; return; }
    renderLogin();
    return;
  }
  if (path === "#/login") { location.hash = "#/dashboard"; return; }

  const s = await settingsAdmin.get();
  currency = s.currencySymbol || "₹";

  if (path === "#/dashboard") await renderDashboard();
  else if (path === "#/pending") await renderListingTable("pending", "#/pending", "Pending Listings");
  else if (path === "#/approved") await renderListingTable("approved", "#/approved", "Approved Listings");
  else if (path === "#/rejected") await renderListingTable("rejected", "#/rejected", "Rejected Listings");
  else if (path === "#/audit") await renderAudit();
  else if (path === "#/settings") await renderSettings();
  else await renderDashboard();
}

window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", router);
if (document.readyState !== "loading") router();
