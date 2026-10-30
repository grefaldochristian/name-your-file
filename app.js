"use strict";

/*
 * Barangay Community Help Hub
 * Offline browser demo — HTML, CSS, vanilla JavaScript, localStorage.
 *
 * SECURITY NOTICE:
 * This is a demonstration only. LocalStorage is not secure and does not provide
 * real authentication, authorization, or multi-device data sharing.
 */

const STORAGE = {
  requests: "brg_requests",
  counter: "brg_request_counter",
  accounts: "brg_demo_accounts",
  session: "brg_demo_session"
};

const STATUSES = ["Pending", "In Progress", "Resolved", "Rejected"];
const URGENCIES = ["Low", "Medium", "High"];

const DEFAULT_REQUESTS = [
  {
    id: "BRG-0001",
    name: "Demo Resident",
    contact: "",
    category: "Garbage Collection",
    purok: "Purok 3",
    urgency: "Medium",
    details: "Sample request: garbage collection follow-up in the area.",
    status: "Pending",
    createdAt: "2026-10-20T08:00:00.000Z",
    updatedAt: "2026-10-20T08:00:00.000Z"
  },
  {
    id: "BRG-0002",
    name: "Demo Resident",
    contact: "",
    category: "Broken Streetlight",
    purok: "Purok 1",
    urgency: "High",
    details: "Sample request: a streetlight needs inspection.",
    status: "In Progress",
    createdAt: "2026-10-21T09:30:00.000Z",
    updatedAt: "2026-10-21T09:30:00.000Z"
  }
];

const DEFAULT_ANNOUNCEMENTS = [
  {
    title: "Welcome to the Barangay Help Hub",
    text: "Use this demo website to submit a community concern, keep the reference number, and check the request status.",
    date: "Sample announcement",
    icon: "⌂"
  },
  {
    title: "Keep your surroundings clean",
    text: "Dispose of waste properly and check verified local collection schedules. Report missed collection using the request form.",
    date: "Community reminder",
    icon: "♻"
  },
  {
    title: "Verify important community updates",
    text: "For real schedules, public advisories, or urgent assistance, contact your barangay through verified official channels.",
    date: "Resident information",
    icon: "▤"
  }
];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function safeRead(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch (error) {
    console.error(`Unable to read localStorage key "${key}".`, error);
    return fallback;
  }
}

function safeWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Unable to save localStorage key "${key}".`, error);
    showToast("Unable to save data. Browser storage may be full or disabled.", "error");
    return false;
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function formatDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function getRequests() {
  const stored = safeRead(STORAGE.requests, null);

  if (Array.isArray(stored)) {
    return stored.filter(item =>
      item && typeof item === "object" && typeof item.id === "string"
    );
  }

  const initial = DEFAULT_REQUESTS.map(item => ({ ...item }));
  safeWrite(STORAGE.requests, initial);
  safeWrite(STORAGE.counter, 2);
  return initial;
}

function saveRequests(requests) {
  return safeWrite(STORAGE.requests, requests);
}

function getAccounts() {
  const accounts = safeRead(STORAGE.accounts, []);
  return Array.isArray(accounts) ? accounts : [];
}

function getSession() {
  const session = safeRead(STORAGE.session, null);
  return session && typeof session === "object" ? session : null;
}

function showToast(message, type = "success") {
  const region = $("#toast-region");
  if (!region) return;

  const toast = document.createElement("div");
  toast.className = `toast${type === "error" ? " error" : type === "warning" ? " warning" : ""}`;
  toast.setAttribute("role", "status");
  toast.textContent = message;
  region.appendChild(toast);

  window.setTimeout(() => toast.remove(), 4500);
}

/* Navigation */

function navigate(viewName) {
  const target = $(`#view-${viewName}`);

  if (!target) {
    console.warn(`Navigation target "view-${viewName}" does not exist.`);
    showToast("That page is not available.", "error");
    return;
  }

  $$(".page-view").forEach(view => {
    view.classList.toggle("hidden", view !== target);
  });

  $$(".nav-btn[data-view]").forEach(button => {
    const active = button.dataset.view === viewName;
    button.classList.toggle("active", active);

    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });

  $("#nav-menu")?.classList.remove("open");
  $("#menu-toggle")?.setAttribute("aria-expanded", "false");
  $("#menu-toggle")?.setAttribute("aria-label", "Open navigation menu");

  if (viewName === "admin") renderAdminTable();
  if (viewName === "announcements") renderAnnouncements();
  if (viewName === "auth") renderSessionPanel();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function handleNavigationClick(event) {
  const button = event.target.closest("[data-view]");
  if (!button) return;

  const viewName = button.dataset.view;
  const category = button.dataset.category;

  if (category && $("#req-category")) {
    $("#req-category").value = category;
  }

  navigate(viewName);
}

function setupNavigation() {
  document.addEventListener("click", handleNavigationClick);

  $("#menu-toggle")?.addEventListener("click", () => {
    const menu = $("#nav-menu");
    const button = $("#menu-toggle");
    if (!menu || !button) return;

    const isOpen = menu.classList.toggle("open");
    button.setAttribute("aria-expanded", String(isOpen));
    button.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
  });
}

/* Request submission */

function createRequestId(requests) {
  const storedCounter = Number(safeRead(STORAGE.counter, 0)) || 0;

  const highestExistingNumber = requests.reduce((highest, request) => {
    const match = /^BRG-(\d+)$/i.exec(String(request.id || ""));
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);

  return `BRG-${String(Math.max(storedCounter, highestExistingNumber) + 1).padStart(4, "0")}`;
}

function showRequestMessage(message, type = "success") {
  const element = $("#request-form-message");
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error", type === "error");
}

function handleHelpRequestSubmit(event) {
  event.preventDefault();

  const form = $("#help-request-form");
  if (!form || !form.reportValidity()) return;

  const name = $("#req-name")?.value.trim() || "";
  const contact = $("#req-contact")?.value.trim() || "";
  const category = $("#req-category")?.value || "";
  const purok = $("#req-purok")?.value.trim() || "";
  const urgency = $("#req-urgency")?.value || "";
  const details = $("#req-details")?.value.trim() || "";
  const consent = $("#req-consent")?.checked || false;

  if (!name || !category || !purok || !details) {
    showRequestMessage("Please complete all required fields.", "error");
    return;
  }

  if (!URGENCIES.includes(urgency)) {
    showRequestMessage("Please select a valid urgency level.", "error");
    return;
  }

  if (!consent) {
    showRequestMessage("Please confirm the demo privacy notice.", "error");
    return;
  }

  const requests = getRequests();
  const duplicate = requests.find(request =>
    normalize(request.category) === normalize(category) &&
    normalize(request.purok) === normalize(purok) &&
    ["Pending", "In Progress"].includes(request.status)
  );

  if (duplicate && !window.confirm(
    `A similar active request already exists (${duplicate.id}).\n\nDo you still want to submit another request?`
  )) return;

  const id = createRequestId(requests);
  const now = new Date().toISOString();

  const request = {
    id, name, contact, category, purok, urgency, details,
    status: "Pending",
    createdAt: now,
    updatedAt: now
  };

  if (!saveRequests([...requests, request])) {
    showRequestMessage("Your request could not be saved. Check browser storage and try again.", "error");
    return;
  }

  const nextCounter = Number(id.replace(/^BRG-/i, ""));
  safeWrite(STORAGE.counter, nextCounter);

  form.reset();
  updateDetailsCount();
  showRequestMessage(`Your request was saved. Your ID is ${id}.`);

  if ($("#track-id")) $("#track-id").value = id;

  renderAdminTable();
  renderTrackResult(request);
  showToast(`Request ${id} was saved successfully.`);
  navigate("track");
}

/* Request tracking */

function renderTrackResult(request) {
  const result = $("#track-result");
  if (!result) return;

  if (!request) {
    result.innerHTML = `
      <div class="notice notice-warning">
        <strong>Request not found</strong>
        <p>Check the reference number and try again. The number must match a request saved in this browser.</p>
      </div>`;
    return;
  }

  const statusClass = {
    "Pending": "status-pending",
    "In Progress": "status-progress",
    "Resolved": "status-resolved",
    "Rejected": "status-rejected"
  }[request.status] || "status-pending";

  const timeline = (() => {
    const steps = ["Pending", "In Progress", "Resolved"];

    if (request.status === "Rejected") {
      return `<span class="timeline-step done">Submitted</span>
        <span class="timeline-step rejected-step">Rejected</span>`;
    }

    const currentIndex = steps.indexOf(request.status);
    return steps.map((status, index) => `
      <span class="timeline-step${index <= currentIndex ? " done" : ""}"
        ${status === request.status ? 'aria-current="step"' : ""}>
        ${escapeHTML(status)}
      </span>
    `).join("");
  })();

  result.innerHTML = `
    <article class="result-card">
      <div class="result-head">
        <div>
          <span class="eyebrow">REQUEST REFERENCE</span>
          <h2 class="result-id">${escapeHTML(request.id)}</h2>
          <p class="field-hint">Submitted ${escapeHTML(formatDate(request.createdAt))}</p>
        </div>
        <span class="status-pill ${statusClass}">${escapeHTML(request.status)}</span>
      </div>
      <div class="result-meta">
        <div><small>Category</small><strong>${escapeHTML(request.category)}</strong></div>
        <div><small>Area</small><strong>${escapeHTML(request.purok)}</strong></div>
        <div><small>Urgency</small><strong>${escapeHTML(request.urgency)}</strong></div>
        <div><small>Last updated</small><strong>${escapeHTML(formatDate(request.updatedAt))}</strong></div>
      </div>
      <div class="result-description">${escapeHTML(request.details)}</div>
      <div><strong>Status progress</strong><div class="timeline">${timeline}</div></div>
      <p class="field-hint">This status is stored in this browser's demo data and is not an official barangay case update.</p>
    </article>`;
}

function handleTrackSubmit(event) {
  event.preventDefault();

  const form = $("#track-form");
  if (!form || !form.reportValidity()) return;

  const id = $("#track-id").value.trim().toUpperCase();
  const request = getRequests().find(item => item.id.toUpperCase() === id);

  renderTrackResult(request);
  showToast(request ? `Showing request ${request.id}.` : "No matching request was found.", request ? "success" : "error");
}

/* Admin dashboard */

function getFilteredRequests() {
  const search = normalize($("#admin-search")?.value);
  const status = $("#admin-filter")?.value || "all";
  const urgency = $("#urgency-filter")?.value || "all";

  return getRequests()
    .filter(request => {
      const searchableText = [
        request.id, request.name, request.contact, request.category,
        request.purok, request.details, request.urgency, request.status
      ].map(normalize).join(" ");

      return (!search || searchableText.includes(search)) &&
        (status === "all" || request.status === status) &&
        (urgency === "all" || request.urgency === urgency);
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function renderAdminStats() {
  const requests = getRequests();

  if ($("#stat-total")) $("#stat-total").textContent = requests.length;
  if ($("#stat-pending")) $("#stat-pending").textContent = requests.filter(item => item.status === "Pending").length;
  if ($("#stat-progress")) $("#stat-progress").textContent = requests.filter(item => item.status === "In Progress").length;
  if ($("#stat-resolved")) $("#stat-resolved").textContent = requests.filter(item => item.status === "Resolved").length;
}

function renderAdminTable() {
  const tbody = $("#admin-table-body");
  if (!tbody) return;

  renderAdminStats();

  const requests = getFilteredRequests();
  tbody.innerHTML = "";

  requests.forEach(request => {
    const row = document.createElement("tr");
    const urgencyClass = {
      High: "status-rejected",
      Medium: "status-pending",
      Low: "status-progress"
    }[request.urgency] || "status-progress";

    const requestStatusClass = {
      "Pending": "status-pending",
      "In Progress": "status-progress",
      "Resolved": "status-resolved",
      "Rejected": "status-rejected"
    }[request.status] || "status-pending";

    const options = STATUSES.map(status =>
      `<option value="${escapeHTML(status)}"${request.status === status ? " selected" : ""}>${escapeHTML(status)}</option>`
    ).join("");

    row.innerHTML = `
      <td><strong>${escapeHTML(request.id)}</strong><small>${escapeHTML(formatDate(request.createdAt))}</small></td>
      <td><strong>${escapeHTML(request.category)}</strong><small>${escapeHTML(request.name)}</small><small>${escapeHTML(request.details)}</small></td>
      <td>${escapeHTML(request.purok)}</td>
      <td><span class="status-pill ${urgencyClass}">${escapeHTML(request.urgency)}</span></td>
      <td><span class="status-pill ${requestStatusClass}">${escapeHTML(request.status)}</span></td>
      <td>
        <label class="field-hint" for="status-${escapeHTML(request.id)}">Change status</label>
        <select class="table-status" id="status-${escapeHTML(request.id)}"
          data-status-id="${escapeHTML(request.id)}"
          aria-label="Update status for ${escapeHTML(request.id)}">${options}</select>
      </td>`;

    tbody.appendChild(row);
  });

  const allRequests = getRequests();
  const count = $("#admin-results-count");
  if (count) count.textContent = `Showing ${requests.length} of ${allRequests.length} request(s).`;

  $("#admin-empty")?.classList.toggle("hidden", requests.length > 0);
  tbody.closest("table")?.classList.toggle("hidden", requests.length === 0);
}

function handleStatusChange(event) {
  const select = event.target.closest("[data-status-id]");
  if (!select) return;

  const session = getSession();
  if (!session || session.role !== "admin") {
    showToast("Please start the demo admin session first.", "error");
    renderAdminTable();
    return;
  }

  const id = select.dataset.statusId;
  const newStatus = select.value;

  if (!STATUSES.includes(newStatus)) {
    showToast("Invalid status selected.", "error");
    renderAdminTable();
    return;
  }

  const requests = getRequests();
  const index = requests.findIndex(request => request.id === id);

  if (index < 0) {
    showToast("This request no longer exists.", "error");
    renderAdminTable();
    return;
  }

  if (requests[index].status === newStatus) return;

  requests[index] = {
    ...requests[index],
    status: newStatus,
    updatedAt: new Date().toISOString()
  };

  if (!saveRequests(requests)) {
    renderAdminTable();
    return;
  }

  renderAdminTable();

  if (normalize($("#track-id")?.value) === normalize(id)) {
    renderTrackResult(requests[index]);
  }

  showToast(`${id} updated to ${newStatus}.`);
}

function clearFilters() {
  if ($("#admin-search")) $("#admin-search").value = "";
  if ($("#admin-filter")) $("#admin-filter").value = "all";
  if ($("#urgency-filter")) $("#urgency-filter").value = "all";
  renderAdminTable();
  showToast("Filters cleared.");
}

function exportDataBackup() {
  const payload = {
    exportedAt: new Date().toISOString(),
    application: "Barangay Community Help Hub Demo",
    warning: "Browser demo data only. This export is not an official record.",
    requests: getRequests(),
    demoAccounts: getAccounts()
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `barangay-help-hub-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("JSON backup exported.");
}

function clearDemoData() {
  if (!window.confirm(
    "Clear ALL demo requests stored in this browser?\n\nThis cannot be undone. Demo accounts will not be deleted."
  )) return;

  if (!saveRequests([]) || !safeWrite(STORAGE.counter, 0)) return;

  if ($("#track-result")) $("#track-result").innerHTML = "";
  renderAdminTable();
  showToast("All demo requests have been cleared.");
}

/* Demo-only authentication */

function setAuthTab(tab) {
  const forms = {
    resident: "#resident-login-form",
    admin: "#admin-login-form",
    register: "#register-form"
  };

  Object.entries(forms).forEach(([name, selector]) => {
    const selected = name === tab;
    $(selector)?.classList.toggle("hidden", !selected);
  });

  [
    ["#tab-resident", "resident"],
    ["#tab-admin", "admin"],
    ["#tab-register", "register"]
  ].forEach(([selector, name]) => {
    const selected = name === tab;
    $(selector)?.classList.toggle("active", selected);
    $(selector)?.setAttribute("aria-selected", String(selected));
  });
}

function setMessage(selector, message, type = "success") {
  const element = $(selector);
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error", type === "error");
}

function handleRegister(event) {
  event.preventDefault();

  const form = $("#register-form");
  if (!form || !form.reportValidity()) return;

  const name = $("#register-name").value.trim();
  const email = normalize($("#register-email").value);
  const password = $("#register-password").value;
  const confirmPassword = $("#register-confirm").value;
  const consent = $("#register-consent").checked;

  if (!name || !email || password.length < 8) {
    setMessage("#register-message", "Complete the required fields. Password must be at least 8 characters.", "error");
    return;
  }

  if (password !== confirmPassword) {
    setMessage("#register-message", "Passwords do not match.", "error");
    return;
  }

  if (!consent) {
    setMessage("#register-message", "Please accept the demo account notice.", "error");
    return;
  }

  const accounts = getAccounts();
  if (accounts.some(account => normalize(account.email) === email)) {
    setMessage("#register-message", "An account with this email already exists in this browser.", "error");
    return;
  }

  // Plain-text password storage is demo-only. Never use for real accounts.
  const account = {
    id: `demo-${Date.now()}`,
    name,
    email,
    password,
    role: "resident",
    createdAt: new Date().toISOString()
  };

  if (!safeWrite(STORAGE.accounts, [...accounts, account])) return;

  form.reset();
  setMessage("#register-message", "Demo account created. You can now log in using your email and password.");
  showToast("Demo account created.");
  setAuthTab("resident");

  if ($("#resident-login-email")) $("#resident-login-email").value = email;
}

function handleResidentLogin(event) {
  event.preventDefault();

  const form = $("#resident-login-form");
  if (!form || !form.reportValidity()) return;

  const email = normalize($("#resident-login-email").value);
  const password = $("#resident-login-password").value;

  const account = getAccounts().find(item =>
    normalize(item.email) === email &&
    item.password === password &&
    item.role === "resident"
  );

  if (!account) {
    setMessage("#resident-login-message", "Login failed. Check your details or register a demo account.", "error");
    return;
  }

  if (!safeWrite(STORAGE.session, {
    name: account.name,
    email: account.email,
    role: "resident",
    startedAt: new Date().toISOString()
  })) return;

  renderSessionPanel();
  showToast("Resident demo login successful.");
  navigate("home");
}

function handleAdminLogin(event) {
  event.preventDefault();

  const form = $("#admin-login-form");
  if (!form || !form.reportValidity()) return;

  const email = normalize($("#admin-login-email").value) || "admin@example.test";

  if (!safeWrite(STORAGE.session, {
    name: "Demo Barangay Admin",
    email,
    role: "admin",
    startedAt: new Date().toISOString()
  })) return;

  renderSessionPanel();
  showToast("Demo admin session started.");
  navigate("admin");
}

function logout() {
  try {
    localStorage.removeItem(STORAGE.session);
  } catch (error) {
    console.error("Could not remove the demo session.", error);
  }

  renderSessionPanel();
  showToast("You have logged out of the demo.");
  navigate("home");
}

function renderSessionPanel() {
  const session = getSession();
  const panel = $("#session-panel");
  if (!panel) return;

  panel.classList.toggle("hidden", !session);

  if (!session) {
    if ($("#session-info")) $("#session-info").textContent = "";
    return;
  }

  if ($("#session-info")) {
    $("#session-info").textContent =
      `Signed in as ${session.name} (${session.role}). This session is for demo purposes only.`;
  }

  $("#session-admin-btn")?.classList.toggle("hidden", session.role !== "admin");
}

/* Announcements and accessibility */

function renderAnnouncements() {
  const container = $("#announcements-list");
  if (!container) return;

  container.innerHTML = DEFAULT_ANNOUNCEMENTS.map(item => `
    <article class="announcement-card">
      <span class="announcement-symbol" aria-hidden="true">${escapeHTML(item.icon)}</span>
      <div>
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.text)}</p>
        <small>${escapeHTML(item.date)}</small>
      </div>
    </article>
  `).join("");
}

function updateDetailsCount() {
  const textarea = $("#req-details");
  const counter = $("#details-count");
  if (textarea && counter) counter.textContent = textarea.value.length;
}

function setupAccessibilityShortcuts() {
  let fontSize = 16;

  document.addEventListener("keydown", event => {
    if (!event.altKey) return;

    if (event.key === "1") {
      fontSize = Math.min(24, fontSize + 1);
      document.documentElement.style.setProperty("--font-base", `${fontSize}px`);
    } else if (event.key === "2") {
      fontSize = Math.max(14, fontSize - 1);
      document.documentElement.style.setProperty("--font-base", `${fontSize}px`);
    } else if (event.key.toLowerCase() === "h") {
      document.body.classList.toggle("high-contrast");
    }
  });
}

/* Initialization */

function initializeDemoStorage() {
  try {
    if (localStorage.getItem(STORAGE.requests) === null) {
      safeWrite(STORAGE.requests, DEFAULT_REQUESTS.map(item => ({ ...item })));
      safeWrite(STORAGE.counter, 2);
    }

    if (localStorage.getItem(STORAGE.accounts) === null) {
      safeWrite(STORAGE.accounts, []);
    }
  } catch (error) {
    console.error("Browser storage is unavailable.", error);
  }
}

function setupEventListeners() {
  $("#help-request-form")?.addEventListener("submit", handleHelpRequestSubmit);
  $("#track-form")?.addEventListener("submit", handleTrackSubmit);
  $("#register-form")?.addEventListener("submit", handleRegister);
  $("#resident-login-form")?.addEventListener("submit", handleResidentLogin);
  $("#admin-login-form")?.addEventListener("submit", handleAdminLogin);

  $("#tab-resident")?.addEventListener("click", () => setAuthTab("resident"));
  $("#tab-admin")?.addEventListener("click", () => setAuthTab("admin"));
  $("#tab-register")?.addEventListener("click", () => setAuthTab("register"));

  $("#logout-btn")?.addEventListener("click", logout);
  $("#req-details")?.addEventListener("input", updateDetailsCount);

  $("#help-request-form")?.addEventListener("reset", () => {
    window.setTimeout(() => {
      updateDetailsCount();
      showRequestMessage("");
    }, 0);
  });

  $("#admin-search")?.addEventListener("input", renderAdminTable);
  $("#admin-filter")?.addEventListener("change", renderAdminTable);
  $("#urgency-filter")?.addEventListener("change", renderAdminTable);
  $("#admin-table-body")?.addEventListener("change", handleStatusChange);

  $("#refresh-admin")?.addEventListener("click", () => {
    renderAdminTable();
    showToast("Dashboard refreshed.");
  });

  $("#clear-filters")?.addEventListener("click", clearFilters);
  $("#export-data")?.addEventListener("click", exportDataBackup);
  $("#clear-demo-data")?.addEventListener("click", clearDemoData);
}

function initializeApp() {
  initializeDemoStorage();
  setupNavigation();
  setupEventListeners();
  setupAccessibilityShortcuts();
  updateDetailsCount();
  renderAnnouncements();
  renderAdminTable();
  renderSessionPanel();

  const requestedView = window.location.hash.replace(/^#/, "");
  const validViews = [
    "home", "help-request", "track", "services",
    "announcements", "contacts", "resources", "auth", "admin"
  ];

  navigate(validViews.includes(requestedView) ? requestedView : "home");
  setAuthTab("resident");
}

document.addEventListener("DOMContentLoaded", initializeApp);