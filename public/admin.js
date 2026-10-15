const admin$ = selector => document.querySelector(selector);
let adminData = null;
const adminMoney = value => `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
const adminDate = value => new Date(String(value).replace(" ", "T") + "Z").toLocaleDateString();
const adminEscape = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));

function showAdminMessage(text, type = "success") {
  const message = admin$("#adminMessage");
  message.textContent = text;
  message.className = `dashboard-message ${type}`;
}

function renderMetrics() {
  const totals = adminData.totals;
  admin$("#adminMetrics").innerHTML = [
    ["Total users", totals.users, "Registered accounts"],
    ["Orders received", totals.orders, "All-time orders"],
    ["Revenue", adminMoney(totals.revenue), "Order total"],
    ["Processing", totals.processing_orders, "Need attention"]
  ].map(([label, value, note]) => `<article class="admin-metric"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`).join("");
}

function renderUsers() {
  const query = admin$("#userSearch").value.trim().toLowerCase();
  const users = adminData.users.filter(user => [user.name, user.email, user.phone].join(" ").toLowerCase().includes(query));
  admin$("#usersTable").innerHTML = users.length ? users.map(user => `<tr><td><strong>${adminEscape(user.name)}</strong><small>#${user.id}</small></td><td>${adminEscape(user.email)}<small>${adminEscape(user.phone || "No phone added")}</small></td><td>${adminDate(user.created_at)}</td><td>${user.order_count}</td><td>${adminMoney(user.order_total)}</td><td><span class="admin-role">${adminEscape(user.role)}</span></td><td><button class="admin-reset-button" data-reset-user="${user.id}">Create reset link</button></td></tr>`).join("") : `<tr><td colspan="7" class="admin-empty">No users found.</td></tr>`;
}

function renderOrders() {
  const filter = admin$("#orderFilter").value;
  const orders = adminData.orders.filter(order => !filter || order.status === filter);
  admin$("#ordersTable").innerHTML = orders.length ? orders.map(order => `<tr><td><strong>${adminEscape(order.order_number)}</strong><small>${adminEscape(order.email)}</small></td><td>${adminEscape(order.customer_name || "Guest")}</td><td>${adminDate(order.created_at)}</td><td>${adminMoney(order.total)}</td><td><span class="order-status">${adminEscape(order.status)}</span></td><td><select class="admin-status-select" data-order-id="${order.id}">${adminData.statuses.map(status => `<option ${status === order.status ? "selected" : ""}>${status}</option>`).join("")}</select></td></tr>`).join("") : `<tr><td colspan="6" class="admin-empty">No orders found.</td></tr>`;
}

async function loadAdmin() {
  const response = await fetch("/api/admin/overview");
  if (response.status === 401) { window.location.href = "/login.html?return=/admin.html"; return; }
  if (response.status === 403) { document.body.innerHTML = "<main class='admin-denied'><h1>Admin access required</h1><p>This account is not authorized to view the RK ENTERPRISES admin panel.</p><a href='/dashboard.html'>Return to account</a></main>"; return; }
  adminData = await response.json();
  renderMetrics(); renderUsers(); renderOrders();
}

admin$("#userSearch").addEventListener("input", renderUsers);
admin$("#orderFilter").addEventListener("change", renderOrders);
admin$("#usersTable").addEventListener("click", async event => {
  const button = event.target.closest("[data-reset-user]");
  if (!button) return;
  button.disabled = true;
  const response = await fetch(`/api/admin/users/${button.dataset.resetUser}/password-reset`, { method: "POST" });
  const result = await response.json();
  button.disabled = false;
  if (!response.ok) { showAdminMessage(result.error || "Could not create reset link.", "error"); return; }
  showAdminMessage(`Password reset email sent to ${result.email}. The link expires in ${result.expiresInMinutes} minutes.`, "success");
});
admin$("#ordersTable").addEventListener("change", async event => {
  if (!event.target.matches(".admin-status-select")) return;
  const orderId = event.target.dataset.orderId;
  const response = await fetch(`/api/admin/orders/${orderId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: event.target.value }) });
  if (!response.ok) { showAdminMessage("Could not update the order status.", "error"); return; }
  const order = adminData.orders.find(item => String(item.id) === orderId);
  if (order) order.status = event.target.value;
  renderMetrics(); renderOrders();
  showAdminMessage(`Order ${order?.order_number || ""} updated.`);
});
admin$("#adminLogout").addEventListener("click", async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login.html"; });
loadAdmin();
