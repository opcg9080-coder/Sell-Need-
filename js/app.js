// ============================================================================
// app.js — marketplace user site (no login, no admin access, no accounts)
// ============================================================================
import { icons } from "./icons.js";
import { listings, settings } from "./db.js";

const appEl = document.getElementById("app");
let currency = "₹";

function esc(s = "") {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function toast(title, tone = "ok") {
  const root = document.getElementById("toast-root");
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `${tone === "ok" ? icons.check : icons.x}<span>${esc(title)}</span>`;
  root.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .2s, transform .2s";
    el.style.opacity = "0";
    el.style.transform = "translateX(14px)";
    setTimeout(() => el.remove(), 220);
  }, 3200);
}

function shell(activeSearch = "") {
  appEl.innerHTML = `
    <header class="topbar">
      <div class="topbar-inner">
        <a href="#/" class="logo"><span class="logo-mark"></span><span class="logo-word">Marketplace</span></a>
        <div class="search-wrap">
          ${icons.search}
          <input class="search-input" id="searchInput" placeholder="Search items…" value="${esc(activeSearch)}" />
        </div>
        <a href="#/sell" class="btn btn-primary btn-sm">${icons.plus} Sell Now</a>
        <a href="#/notifications" class="icon-btn" aria-label="Notifications">${icons.bell}</a>
        <a href="#/" class="icon-btn" aria-label="Profile">${icons.user}</a>
      </div>
    </header>
    <main class="main" id="mainContent"></main>
  `;
  const input = document.getElementById("searchInput");
  input.addEventListener("input", () => {
    location.hash = `#/?q=${encodeURIComponent(input.value)}`;
  });
  return document.getElementById("mainContent");
}

async function renderHome(query) {
  const main = shell(query);
  const items = await listings.approvedList(query);

  main.innerHTML = items.length === 0 ? `
    <div class="empty-state">
      ${icons.tag}
      <h3>No items found</h3>
      <p>${query ? "Try a different search term." : "Be the first to list something."}</p>
    </div>
  ` : `
    <div class="listing-list">
      ${items.map((it) => `
        <div class="listing-row">
          <span class="listing-name">${esc(it.name)}</span>
          <span class="price-badge">${currency}${it.price}</span>
          <a href="#/item/${it.id}" class="btn btn-ghost btn-sm">Buy Details</a>
        </div>
      `).join("")}
    </div>
  `;
}

async function renderDetail(id) {
  const main = shell();
  const item = await listings.get(id);

  if (!item || item.status !== "approved") {
    main.innerHTML = `
      <a href="#/" class="back-link">${icons.back} Back</a>
      <div class="empty-state">${icons.tag}<h3>Listing not available</h3><p>This item may have been removed or is not yet approved.</p></div>
    `;
    return;
  }

  main.innerHTML = `
    <a href="#/" class="back-link">${icons.back} Back</a>
    <div class="detail-card">
      <h2>${esc(item.name)}</h2>
      <div class="detail-price">${currency}${item.price}</div>
      <div style="margin-top:22px;">
        <div class="detail-row"><span class="label">Seller Name</span><span class="value">${esc(item.sellerName)}</span></div>
        <div class="detail-row"><span class="label">Contact Method</span><span class="value">${esc(item.contact || "—")}</span></div>
        <div class="detail-row"><span class="label">Delivery / Order Method</span><span class="value">${esc(item.orderMethod)}</span></div>
      </div>
      ${item.description ? `<div class="detail-desc">${esc(item.description)}</div>` : ""}
    </div>
  `;
}

function renderSell() {
  const main = shell();
  main.innerHTML = `
    <a href="#/" class="back-link">${icons.back} Back</a>
    <div class="form-card">
      <h2 style="margin-bottom:22px;">Sell an item</h2>
      <form id="sellForm">
        <div class="field"><label for="itemName">Item name</label><input class="input" id="itemName" placeholder="e.g. Wooden study chair" required /></div>
        <div class="field"><label for="sellerName">Your name</label><input class="input" id="sellerName" placeholder="e.g. Ravi Kumar" /></div>
        <div class="field"><label for="price">Price (${currency})</label><input class="input" id="price" type="number" min="1" placeholder="0" required /></div>
        <div class="field"><label for="contact">Contact method</label><input class="input" id="contact" placeholder="Phone number or preferred contact" required /></div>
        <div class="field"><label for="orderMethod">Delivery / order method</label><input class="input" id="orderMethod" placeholder="e.g. Pickup only, Courier available" /></div>
        <div class="field"><label for="description">Description</label><textarea class="textarea" id="description" placeholder="Describe the item's condition, age, etc."></textarea></div>
        <span class="help-text is-error" id="formErr" style="display:block;margin-bottom:14px;"></span>
        <button type="submit" class="btn btn-primary btn-block">List Now</button>
      </form>
      <div id="pendingArea"></div>
    </div>
  `;

  document.getElementById("sellForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = document.getElementById("formErr");
    errEl.textContent = "";
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;

    const res = await listings.submit({
      name: document.getElementById("itemName").value,
      sellerName: document.getElementById("sellerName").value,
      price: document.getElementById("price").value,
      contact: document.getElementById("contact").value,
      orderMethod: document.getElementById("orderMethod").value,
      description: document.getElementById("description").value,
    });

    btn.disabled = false;
    if (!res.ok) { errEl.textContent = res.error; return; }

    document.getElementById("sellForm").style.display = "none";
    document.getElementById("pendingArea").innerHTML = `
      <div class="pending-banner">
        ${icons.clock}
        <div>
          <div class="title">Pending Admin Approval</div>
          <div class="sub">Your listing will appear on the homepage once it's reviewed.</div>
        </div>
      </div>
    `;
    toast("Listing submitted for review");
  });
}

function renderNotifications() {
  const main = shell();
  main.innerHTML = `
    <a href="#/" class="back-link">${icons.back} Back</a>
    <div class="empty-state">${icons.bell}<h3>No notifications yet</h3><p>Updates about your listings will appear here.</p></div>
  `;
}

async function router() {
  const s = await settings.get();
  currency = s.currencySymbol || "₹";

  const hash = location.hash || "#/";
  const [path, qs] = hash.replace(/^#/, "").split("?");
  const params = new URLSearchParams(qs || "");

  if (path === "/" || path === "") {
    await renderHome(params.get("q") || "");
  } else if (path.startsWith("/item/")) {
    await renderDetail(path.split("/item/")[1]);
  } else if (path === "/sell") {
    renderSell();
  } else if (path === "/notifications") {
    renderNotifications();
  } else {
    await renderHome("");
  }
}

window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", router);
if (document.readyState !== "loading") router();
