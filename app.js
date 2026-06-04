// ─────────────────────────────────────────────────────────────────────────────
// WikiStudi Invoice Portal — app.js
// Full Supabase integration (auth + database). No localStorage for data.
// ─────────────────────────────────────────────────────────────────────────────

// ── Supabase client ────────────────────────────────────────────────────────
const { createClient } = supabase;
const sb = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

// ── DOM refs ───────────────────────────────────────────────────────────────
const loginScreen        = document.querySelector("#loginScreen");
const portalApp          = document.querySelector("#portalApp");
const loginForm          = document.querySelector("#loginForm");
const logoutButton       = document.querySelector("#logoutButton");
const signedInEmail      = document.querySelector("#signedInEmail");
const pageTitle          = document.querySelector("#pageTitle");
const navLinks           = document.querySelectorAll(".nav-link");
const tabPanels          = document.querySelectorAll(".tab-panel");
const form               = document.querySelector("#invoiceForm");
const saveInvoiceButton  = document.querySelector("#saveInvoice");
const newInvoiceButton   = document.querySelector("#newInvoice");
const quickNewInvoiceButton = document.querySelector("#quickNewInvoice");
const saveClientButton   = document.querySelector("#saveClient");
const clientSearch       = document.querySelector("#clientSearch");
const clientList         = document.querySelector("#clientList");
const invoiceRows        = document.querySelector("#invoiceRows");
const bulletsList        = document.querySelector("#itemBullets");
const paymentLinkEl      = document.querySelector("#paymentLink");
const termsText          = document.querySelector("#termsText");
const qrCode             = document.querySelector("#qrCode");
const saveMessage        = document.querySelector("#saveMessage");
const metricInvoices     = document.querySelector("#metricInvoices");
const metricRevenue      = document.querySelector("#metricRevenue");
const metricOutstanding  = document.querySelector("#metricOutstanding");
const metricClients      = document.querySelector("#metricClients");
const statusCounters     = document.querySelector("#statusCounters");
const revenueChart       = document.querySelector("#revenueChart");
const downloadButton     = document.querySelector("#downloadInvoiceTop");

// ── State ──────────────────────────────────────────────────────────────────
let currentUser      = null;   // Supabase user object
let allInvoices      = [];     // cached from DB
let allClients       = [];     // cached from DB
let totalInvoiceCount = 0;     // for auto-numbering

const statuses = ["Draft", "Sent", "Partially Paid", "Paid", "Overdue", "Cancelled"];

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

// ── Helpers ────────────────────────────────────────────────────────────────
function val(name) {
  return form.elements[name].value.trim();
}

function numVal(name) {
  return Number(form.elements[name].value || 0);
}

function escapeText(text) {
  const span = document.createElement("span");
  span.textContent = text ?? "";
  return span.innerHTML;
}

function flash(message, isError = false) {
  saveMessage.textContent = message;
  saveMessage.style.color = isError ? "var(--danger)" : "var(--success)";
  clearTimeout(flash._t);
  flash._t = setTimeout(() => { saveMessage.textContent = ""; }, 2400);
}

function setTab(tabName) {
  navLinks.forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tabName));
  tabPanels.forEach((p) => p.classList.toggle("active", p.dataset.panel === tabName));
  pageTitle.textContent = {
    dashboard: "Dashboard",
    invoices:  "Invoices",
    clients:   "Clients",
    editor:    "Create Invoice",
  }[tabName] ?? "Dashboard";
}

function showPortal(user) {
  currentUser = user;
  signedInEmail.textContent = user.email;
  loginScreen.classList.add("hidden");
  portalApp.classList.remove("hidden");
}

function showLogin() {
  currentUser = null;
  allInvoices = [];
  allClients  = [];
  loginScreen.classList.remove("hidden");
  portalApp.classList.add("hidden");
}

function setText(selector, text) {
  document.querySelectorAll(selector).forEach((node) => { node.textContent = text; });
}

// ── Invoice form → computed data ───────────────────────────────────────────
function getInvoiceData() {
  const quantity  = numVal("quantity");
  const rate      = numVal("rate");
  const deposit   = numVal("deposit");
  const lineTotal = quantity * rate;

  return {
    companyName:   val("companyName"),
    companyPhone:  val("companyPhone"),
    companyEmail:  val("companyEmail"),
    invoiceNumber: val("invoiceNumber"),
    dateIssued:    val("dateIssued"),
    dueDate:       val("dueDate"),
    status:        val("status"),
    clientName:    val("clientName"),
    clientEmail:   val("clientEmail"),
    clientPhone:   val("clientPhone"),
    clientAddress: val("clientAddress"),
    paymentLink:   val("paymentLink"),
    deposit,
    itemTitle:     val("itemTitle"),
    quantity,
    rate,
    itemBullets:   val("itemBullets"),
    terms:         val("terms"),
    lineTotal,
    remaining:     Math.max(lineTotal - deposit, 0),
  };
}

function setFormData(data) {
  Object.entries(data).forEach(([key, value]) => {
    if (form.elements[key]) {
      form.elements[key].value = value ?? "";
    }
  });
  updateInvoicePreview();
}

// ── Live PDF preview ───────────────────────────────────────────────────────
function updateInvoicePreview() {
  const d = getInvoiceData();

  document.querySelectorAll("[data-bind]").forEach((node) => {
    node.textContent = d[node.dataset.bind] || "";
  });

  setText('[data-money="rate"]',      money.format(d.rate));
  setText('[data-money="deposit"]',   money.format(d.deposit));
  setText('[data-money="remaining"]', money.format(d.remaining));
  setText('[data-money="lineTotal"]', money.format(d.lineTotal));

  // Bullet list
  bulletsList.innerHTML = "";
  d.itemBullets
    .split(/\n+/)
    .map((b) => b.trim())
    .filter(Boolean)
    .forEach((b) => {
      const li = document.createElement("li");
      li.textContent = b;
      bulletsList.append(li);
    });

  // Payment link + QR
  paymentLinkEl.textContent = d.paymentLink;
  paymentLinkEl.href = d.paymentLink || "#";
  if (d.paymentLink) {
    qrCode.src = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=8&data=${encodeURIComponent(d.paymentLink)}`;
    qrCode.style.display = "block";
  } else {
    qrCode.src = "";
    qrCode.style.display = "none";
  }

  termsText.textContent = d.terms;
}

// ── Auto invoice number ────────────────────────────────────────────────────
function nextInvoiceNumber() {
  const base = allInvoices.length + totalInvoiceCount;
  return `WIKI-${String(base + 165).padStart(4, "0")}`;
}

// ── Dashboard rendering ────────────────────────────────────────────────────
function renderDashboard() {
  const invoices = allInvoices;
  const revenue     = invoices.reduce((s, i) => s + Number(i.total_amount  || i.lineTotal  || 0), 0);
  const outstanding = invoices.reduce((s, i) => s + Number(i.remaining_amount || i.remaining || 0), 0);

  metricInvoices.textContent   = String(invoices.length);
  metricRevenue.textContent    = money.format(revenue);
  metricOutstanding.textContent= money.format(outstanding);
  metricClients.textContent    = String(allClients.length);

  // Status counters
  const maxStatus = Math.max(...statuses.map((s) => invoices.filter((i) => i.status === s).length), 1);
  statusCounters.innerHTML = statuses.map((status) => {
    const count = invoices.filter((i) => i.status === status).length;
    return `
      <div class="status-counter">
        <span>${status}</span>
        <div class="counter-track"><div class="counter-fill" style="width:${(count / maxStatus) * 100}%"></div></div>
        <strong>${count}</strong>
      </div>`;
  }).join("");

  // Revenue chart (last 6)
  const recent    = invoices.slice(-6);
  const maxAmount = Math.max(...recent.map((i) => Number(i.total_amount || i.lineTotal || 0)), 1);
  revenueChart.innerHTML = recent.length
    ? recent.map((i) => {
        const amt = Number(i.total_amount || i.lineTotal || 0);
        const num = i.invoice_number || i.invoiceNumber || "";
        return `
          <div class="bar-row">
            <span>${escapeText(num)}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${(amt / maxAmount) * 100}%"></div></div>
            <strong>${money.format(amt)}</strong>
          </div>`;
      }).join("")
    : '<p class="empty-state">No revenue yet. Save invoices to populate this chart.</p>';
}

// ── Invoices table ─────────────────────────────────────────────────────────
function statusClass(s) {
  return s.toLowerCase().replace(/\s+/g, "-");
}

function renderInvoices() {
  invoiceRows.innerHTML = "";
  if (!allInvoices.length) {
    invoiceRows.innerHTML = '<tr><td colspan="5">No invoices saved yet.</td></tr>';
    return;
  }

  [...allInvoices].reverse().forEach((inv) => {
    const id     = inv.db_id || inv.id;
    const num    = inv.invoice_number || inv.invoiceNumber || "";
    const client = inv.client_name    || inv.clientName   || "";
    const total  = Number(inv.total_amount || inv.lineTotal || 0);
    const status = inv.status || "Draft";

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeText(num)}</td>
      <td>${escapeText(client)}</td>
      <td>${money.format(total)}</td>
      <td><span class="status-pill ${statusClass(status)}">${escapeText(status)}</span></td>
      <td>
        <div class="row-actions">
          <button class="load-row" type="button" data-action="edit" data-id="${escapeText(id)}">Edit</button>
          <button class="view-row" type="button" data-action="view" data-id="${escapeText(id)}">View</button>
        </div>
      </td>`;
    invoiceRows.append(row);
  });
}

// ── Clients grid ───────────────────────────────────────────────────────────
function renderClients() {
  const query    = (clientSearch.value || "").toLowerCase();
  const filtered = allClients.filter((c) =>
    [c.name || c.clientName, c.email || c.clientEmail, c.phone || c.clientPhone]
      .filter(Boolean)
      .some((f) => f.toLowerCase().includes(query))
  );

  clientList.innerHTML = "";
  if (!filtered.length) {
    clientList.innerHTML = '<p class="empty-state">No clients yet. Fill client details in the editor then click "Save current client".</p>';
    return;
  }

  filtered.forEach((c) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "client-card";
    btn.dataset.email = c.email || c.clientEmail;
    btn.innerHTML = `
      <strong>${escapeText(c.name || c.clientName)}</strong>
      <span>${escapeText(c.email || c.clientEmail)}</span>
      <span>${escapeText(c.phone || c.clientPhone || "No phone")}</span>`;
    clientList.append(btn);
  });
}

function renderAll() {
  renderDashboard();
  renderClients();
  renderInvoices();
}

// ── Supabase data loaders ──────────────────────────────────────────────────
async function loadInvoices() {
  const { data, error } = await sb
    .from("invoice_summary")
    .select("*")
    .eq("owner_id", currentUser.id)
    .order("updated_at", { ascending: true });

  if (error) {
    console.error("loadInvoices error:", error.message);
    return;
  }
  // Normalise field names for renderAll / getInvoiceData compatibility
  allInvoices = (data || []).map((row) => ({
    ...row,
    db_id:          row.id,
    invoice_number: row.invoice_number,
    invoiceNumber:  row.invoice_number,
    client_name:    row.client_name,
    clientName:     row.client_name,
    lineTotal:      row.total_amount,
    remaining:      row.remaining_amount,
  }));
  totalInvoiceCount = allInvoices.length;
}

async function loadClients() {
  const { data, error } = await sb
    .from("clients")
    .select("id, name, email, phone, address, notes")
    .eq("owner_id", currentUser.id)
    .order("name");

  if (error) {
    console.error("loadClients error:", error.message);
    return;
  }
  allClients = (data || []).map((c) => ({
    ...c,
    clientName:    c.name,
    clientEmail:   c.email,
    clientPhone:   c.phone,
    clientAddress: c.address,
  }));
}

async function loadFullInvoice(dbId) {
  // Load invoice row
  const { data: inv, error: invErr } = await sb
    .from("invoices")
    .select("*, clients(name, email, phone, address)")
    .eq("id", dbId)
    .single();

  if (invErr || !inv) {
    flash("Could not load invoice.", true);
    return null;
  }

  // Load first invoice item
  const { data: items } = await sb
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", dbId)
    .order("sort_order")
    .limit(1);

  const item = items?.[0] || {};
  const client = inv.clients || {};

  return {
    db_id:         inv.id,
    companyName:   "The WikiStudi",
    companyPhone:  "+1 (218) 305-9586",
    companyEmail:  "benjamin.wikieditor@gmail.com",
    invoiceNumber: inv.invoice_number,
    dateIssued:    inv.issue_date   ? formatDateDisplay(inv.issue_date)  : "",
    dueDate:       inv.due_date     ? formatDateDisplay(inv.due_date)    : "",
    status:        inv.status,
    clientName:    client.name    || "",
    clientEmail:   client.email   || "",
    clientPhone:   client.phone   || "",
    clientAddress: client.address || "",
    paymentLink:   inv.payment_link || "",
    deposit:       inv.deposit_amount  || 0,
    itemTitle:     item.title          || "WIKIPEDIA PAGE CREATION",
    quantity:      item.quantity       || 1,
    rate:          item.rate           || 0,
    itemBullets:   (item.bullet_details || []).join("\n"),
    terms:         inv.terms || "",
    lineTotal:     inv.total_amount    || 0,
    remaining:     inv.remaining_amount|| 0,
  };
}

// ── Date helpers ───────────────────────────────────────────────────────────
// Display format: DD/MM/YYYY
// Storage format: YYYY-MM-DD (ISO)

function toISODate(display) {
  if (!display) return null;
  // Accept YYYY-MM-DD directly
  if (/^\d{4}-\d{2}-\d{2}$/.test(display)) return display;
  // Accept DD/MM/YYYY
  const parts = display.split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function formatDateDisplay(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ── Save invoice to Supabase ───────────────────────────────────────────────
async function saveCurrentInvoice() {
  if (!currentUser) return;

  saveInvoiceButton.disabled = true;
  const d = getInvoiceData();

  // 1. Upsert client
  let clientId = null;
  if (d.clientName && d.clientEmail) {
    const { data: clientRow, error: cErr } = await sb
      .from("clients")
      .upsert(
        {
          owner_id: currentUser.id,
          name:     d.clientName,
          email:    d.clientEmail,
          phone:    d.clientPhone  || null,
          address:  d.clientAddress|| null,
        },
        { onConflict: "owner_id,email" }
      )
      .select("id")
      .single();

    if (cErr) {
      console.error("client upsert error:", cErr.message);
    } else {
      clientId = clientRow?.id || null;
      // Refresh local clients cache
      await loadClients();
    }
  }

  // 2. Upsert invoice
  const issueDate = toISODate(d.dateIssued);
  const dueDate   = toISODate(d.dueDate);

  const invoicePayload = {
    owner_id:         currentUser.id,
    client_id:        clientId,
    invoice_number:   d.invoiceNumber,
    status:           d.status,
    issue_date:       issueDate,
    due_date:         dueDate,
    payment_link:     d.paymentLink || null,
    terms:            d.terms       || null,
    subtotal:         d.lineTotal,
    deposit_amount:   d.deposit,
    remaining_amount: d.remaining,
    total_amount:     d.lineTotal,
  };

  // Check if invoice already exists (by invoice_number for this user)
  const { data: existing } = await sb
    .from("invoices")
    .select("id")
    .eq("owner_id", currentUser.id)
    .eq("invoice_number", d.invoiceNumber)
    .maybeSingle();

  let invoiceId;

  if (existing?.id) {
    // Update
    invoiceId = existing.id;
    const { error: upErr } = await sb
      .from("invoices")
      .update(invoicePayload)
      .eq("id", invoiceId);
    if (upErr) {
      flash("Error updating invoice: " + upErr.message, true);
      saveInvoiceButton.disabled = false;
      return;
    }
  } else {
    // Insert
    const { data: newInv, error: insErr } = await sb
      .from("invoices")
      .insert(invoicePayload)
      .select("id")
      .single();
    if (insErr) {
      flash("Error saving invoice: " + insErr.message, true);
      saveInvoiceButton.disabled = false;
      return;
    }
    invoiceId = newInv.id;
  }

  // 3. Upsert invoice item (delete old, insert fresh for simplicity)
  await sb.from("invoice_items").delete().eq("invoice_id", invoiceId);

  const bullets = d.itemBullets
    .split(/\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  await sb.from("invoice_items").insert({
    owner_id:       currentUser.id,
    invoice_id:     invoiceId,
    title:          d.itemTitle || "WIKIPEDIA PAGE CREATION",
    bullet_details: bullets,
    quantity:       d.quantity,
    rate:           d.rate,
    sort_order:     0,
  });

  // 4. Refresh and navigate
  await loadInvoices();
  renderAll();
  flash("Invoice saved ✓");
  setTab("invoices");
  saveInvoiceButton.disabled = false;
}

// ── Save client to Supabase ────────────────────────────────────────────────
async function saveCurrentClient() {
  if (!currentUser) return;

  const name  = val("clientName");
  const email = val("clientEmail");
  if (!name || !email) {
    flash("Client name and email are required.", true);
    return;
  }

  const { error } = await sb.from("clients").upsert(
    {
      owner_id: currentUser.id,
      name,
      email,
      phone:   val("clientPhone")   || null,
      address: val("clientAddress") || null,
    },
    { onConflict: "owner_id,email" }
  );

  if (error) {
    flash("Error saving client: " + error.message, true);
    return;
  }

  await loadClients();
  renderAll();
  flash("Client saved ✓");
}

// ── New invoice ────────────────────────────────────────────────────────────
function startNewInvoice() {
  setFormData({
    invoiceNumber: nextInvoiceNumber(),
    dateIssued:    "",
    dueDate:       "",
    status:        "Draft",
    clientName:    "",
    clientEmail:   "",
    clientPhone:   "",
    clientAddress: "",
    paymentLink:   "",
    deposit:       0,
    itemTitle:     "WIKIPEDIA PAGE CREATION",
    quantity:      1,
    rate:          750,
    itemBullets:   "Notability & Source Evaluation\nResearch & Information Verification\nWikipedia Draft Writing\nCitation & Reference Formatting\nArticle Submission & Review Handling",
    terms:         "Payment is due in 4 days.\n100% refund policy if page is not published.",
  });
  setTab("editor");
  flash("New draft ready");
}

// ── Invoice view mode (public/client-facing link) ──────────────────────────
async function enterInvoiceViewMode() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("view") !== "invoice") return false;

  const id = params.get("id");
  document.body.classList.add("invoice-view");

  // For view mode we need to be logged in OR have a public data fetch.
  // Since this is single-admin, we sign in silently via existing session.
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    // Show just the invoice page without portal chrome
    document.body.innerHTML = `
      <div style="display:grid;place-items:center;min-height:100vh;font-family:sans-serif;color:#555;">
        <p>Please <a href="/">sign in</a> to view this invoice.</p>
      </div>`;
    return true;
  }

  currentUser = session.user;
  showPortal(session.user);
  setTab("editor");

  const invoiceData = await loadFullInvoice(id);
  if (invoiceData) {
    setFormData(invoiceData);
    document.title = `${invoiceData.invoiceNumber} - Invoice`;
  }
  return true;
}

function openInvoiceView(dbId) {
  const url = `${window.location.pathname}?view=invoice&id=${encodeURIComponent(dbId)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

// ── Event listeners ────────────────────────────────────────────────────────

// Login
const loginError = document.querySelector("#loginError");
function showLoginError(msg) {
  loginError.textContent = msg;
  loginError.classList.remove("hidden");
}
function hideLoginError() {
  loginError.textContent = "";
  loginError.classList.add("hidden");
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = loginForm.querySelector("button[type=submit]");
  btn.disabled = true;
  btn.textContent = "Signing in…";
  hideLoginError();

  const email    = loginForm.elements.email.value.trim();
  const password = loginForm.elements.password.value;

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  btn.disabled = false;
  btn.textContent = "Login to dashboard";

  if (error) {
    showLoginError(error.message || "Login failed. Check your credentials.");
    return;
  }

  // Directly handle session in case onAuthStateChange doesn't fire
  if (data?.user) {
    currentUser = data.user;
    await loadInvoices();
    await loadClients();
    renderAll();
    updateInvoicePreview();
    showPortal(data.user);
    setTab("dashboard");
  }
});

// Logout
logoutButton.addEventListener("click", async () => {
  await sb.auth.signOut();
  showLogin();
});

// Navigation
navLinks.forEach((btn) => btn.addEventListener("click", () => setTab(btn.dataset.tab)));

// Invoice form — live preview
form.addEventListener("input", updateInvoicePreview);

// Save / new
saveInvoiceButton.addEventListener("click", saveCurrentInvoice);
newInvoiceButton.addEventListener("click", startNewInvoice);
quickNewInvoiceButton.addEventListener("click", startNewInvoice);
saveClientButton.addEventListener("click", saveCurrentClient);
downloadButton.addEventListener("click", () => window.print());
clientSearch.addEventListener("input", renderClients);

// Client card click → fill editor
clientList.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-email]");
  if (!btn) return;
  const c = allClients.find((x) => (x.email || x.clientEmail) === btn.dataset.email);
  if (c) {
    setFormData({
      clientName:    c.name    || c.clientName,
      clientEmail:   c.email   || c.clientEmail,
      clientPhone:   c.phone   || c.clientPhone   || "",
      clientAddress: c.address || c.clientAddress || "",
    });
    setTab("editor");
    flash("Client loaded ✓");
  }
});

// Invoice row actions
invoiceRows.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-id]");
  if (!btn) return;

  const dbId = btn.dataset.id;

  if (btn.dataset.action === "view") {
    openInvoiceView(dbId);
    return;
  }

  // Edit: load full invoice data into form
  btn.disabled = true;
  btn.textContent = "Loading…";
  const data = await loadFullInvoice(dbId);
  btn.disabled = false;
  btn.textContent = "Edit";

  if (data) {
    setFormData(data);
    setTab("editor");
    flash("Invoice loaded ✓");
  }
});

// ── Auth state change (central session handler) ────────────────────────────
sb.auth.onAuthStateChange(async (event, session) => {
  if (event === "SIGNED_IN" && session?.user) {
    currentUser = session.user;
    await loadInvoices();
    await loadClients();
    renderAll();
    updateInvoicePreview();
    showPortal(session.user);
    setTab("dashboard");
  } else if (event === "SIGNED_OUT") {
    showLogin();
  }
});

// ── Boot ───────────────────────────────────────────────────────────────────
(async function boot() {
  // Check for invoice view mode first
  const isViewMode = await enterInvoiceViewMode();
  if (isViewMode) return;

  // Normal portal mode — restore existing session
  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) {
    currentUser = session.user;
    await loadInvoices();
    await loadClients();
    renderAll();
    updateInvoicePreview();
    showPortal(session.user);
    setTab("dashboard");
  } else {
    showLogin();
    updateInvoicePreview(); // Render default preview values
  }
})();
