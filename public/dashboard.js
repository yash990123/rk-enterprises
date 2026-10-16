const dashboard$ = selector => document.querySelector(selector);
const dashboardMoney = value => `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
const orderStages = ["Processing", "Packed", "Shipped", "Out for delivery", "Delivered"];
let accountData = null;
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));

function renderOrder(order) {
  const activeIndex = Math.max(0, orderStages.findIndex(stage => stage.toLowerCase() === String(order.status).toLowerCase()));
  const tracking = order.tracking_number || `CH-TRACK-${order.order_number.replace("CH-", "")}`;
  return `
    <article class="order-entry">
      <div class="order-row">
        <div><strong>${order.order_number}</strong><small>${new Date(order.created_at.replace(" ", "T") + "Z").toLocaleDateString()}</small></div>
        <span class="order-status">${order.status}</span>
        <strong>${dashboardMoney(order.total)}</strong>
      </div>
      <div class="order-tracking">
        <div class="tracking-heading"><div><span class="tracking-label">Tracking number</span><strong>${tracking}</strong></div><span class="tracking-update">Live order status</span></div>
        <ol class="tracking-steps">
          ${orderStages.map((stage, index) => `<li class="${index < activeIndex ? "complete" : ""} ${index === activeIndex ? "active" : ""}"><span class="tracking-dot">${index < activeIndex ? "✓" : index + 1}</span><span>${stage}</span></li>`).join("")}
        </ol>
        <p class="tracking-note">${activeIndex === orderStages.length - 1 ? "Your order has been delivered." : `Your order is currently ${order.status.toLowerCase()}. We'll keep you updated as it moves.`}</p>
      </div>
    </article>`;
}

async function loadDashboard() {
  const response = await fetch("/api/account");
  if (response.status === 401) {
    window.location.href = "/login.html?return=/dashboard.html";
    return;
  }
  const result = await response.json();
  accountData = result;
  const isAdmin = result.user.role === "admin";
  dashboard$("#adminNavLink").hidden = !isAdmin;
  dashboard$("#adminAccountLink").hidden = !isAdmin;
  dashboard$("#profileName").value = result.user.name;
  dashboard$("#profileEmail").value = result.user.email;
  dashboard$("#profilePhone").value = result.user.phone || "";
  dashboard$("#profileAvatar").textContent = result.user.name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
  dashboard$("#orderCount").textContent = `${result.orders.length} ${result.orders.length === 1 ? "order" : "orders"}`;
  dashboard$("#ordersList").innerHTML = result.orders.length
    ? result.orders.map(renderOrder).join("")
    : `<div class="orders-empty"><span>◌</span><h3>No orders yet</h3><p>Your completed purchases will appear here.</p><a class="dashboard-link" href="/#shop">Explore the collection <span>→</span></a></div>`;
}

function showAccountModal(type) {
  const modal = dashboard$("#accountModal");
  const title = dashboard$("#accountModalTitle");
  const body = dashboard$("#accountModalBody");
  const templates = {
    addresses: ["Your addresses", `
      <div class="modal-list">${accountData.addresses.length ? accountData.addresses.map(address => `<article class="modal-list-item"><div><strong>${escapeHtml(address.label)}${address.is_default ? " · Default" : ""}</strong><small>${escapeHtml(address.recipient)}<br>${escapeHtml(address.phone)}<br>${escapeHtml(address.line1)}, ${escapeHtml(address.city)}, ${escapeHtml(address.state)} ${escapeHtml(address.postal_code)}</small></div><button class="text-button" data-delete-address="${address.id}">Remove</button></article>`).join("") : `<p class="modal-muted">No saved addresses yet.</p>`}</div>
      <form class="modal-form" data-modal-form="address"><h3>Add a billing or delivery address</h3><div class="form-two"><label>Label<input name="label" placeholder="Home or office" required></label><label>Recipient<input name="recipient" placeholder="Full name" required></label></div><label>Contact phone<input name="phone" type="tel" autocomplete="tel" placeholder="+1 (555) 123-4567" required></label><label>Street address<input name="line1" required></label><div class="form-three"><label>City<input name="city" required></label><label>State<input name="state" required></label><label>ZIP code<input name="postal_code" required></label></div><label class="check-row"><input type="checkbox" name="is_default"> Make this my default address</label><button class="button button-dark" type="submit">Save address <span>→</span></button></form>`],
    payments: ["Payment options", `
      <div class="modal-list">${accountData.paymentMethods.length ? accountData.paymentMethods.map(card => `<article class="modal-list-item"><div><strong>${escapeHtml(card.brand)} ending in ${escapeHtml(card.last4)}${card.is_default ? " · Default" : ""}</strong><small>Expires ${String(card.expiry_month).padStart(2, "0")}/${card.expiry_year}</small></div><button class="text-button" data-delete-payment="${card.id}">Remove</button></article>`).join("") : `<p class="modal-muted">No payment methods saved yet.</p>`}</div>
      <form class="modal-form" data-modal-form="payment"><h3>Add a payment method</h3><div class="form-two"><label>Card brand<input name="brand" placeholder="Visa, Mastercard..." required></label><label>Card number<input name="number" inputmode="numeric" autocomplete="cc-number" required></label></div><div class="form-two"><label>Expiry month<input name="expiry_month" type="number" min="1" max="12" required></label><label>Expiry year<input name="expiry_year" type="number" min="${new Date().getFullYear()}" required></label></div><label class="check-row"><input type="checkbox" name="is_default"> Make this my default payment method</label><p class="modal-muted">For your security, RK ENTERPRISES stores only the last four digits.</p><button class="button button-dark" type="submit">Save payment method <span>→</span></button></form>`],
    preferences: ["Communication preferences", `
      <form class="modal-form" data-modal-form="preferences"><p class="modal-muted">Choose which updates you want to receive from RK ENTERPRISES.</p><label class="check-row"><input type="checkbox" name="order_updates" ${accountData.preferences.order_updates ? "checked" : ""}> Order and delivery updates</label><label class="check-row"><input type="checkbox" name="promotions" ${accountData.preferences.promotions ? "checked" : ""}> Offers and promotions</label><label class="check-row"><input type="checkbox" name="product_news" ${accountData.preferences.product_news ? "checked" : ""}> New product announcements</label><button class="button button-dark" type="submit">Save preferences <span>→</span></button></form>`],
    support: ["Customer support", `<form class="modal-form" data-modal-form="support"><p class="modal-muted">Send us a message and our support team will follow up by email.</p><label>Subject<input name="subject" placeholder="How can we help?" required></label><label>Message<textarea name="message" rows="5" minlength="10" required></textarea></label><button class="button button-dark" type="submit">Send support request <span>→</span></button></form>`],
    security: ["Login & security", `<form class="modal-form" data-modal-form="security"><p class="modal-muted">Change your password without leaving your account.</p><label>Current password<input name="current_password" type="password" required></label><label>New password<input name="new_password" type="password" minlength="8" required></label><label>Confirm new password<input name="confirm_password" type="password" minlength="8" required></label><button class="button button-dark" type="submit">Update password <span>→</span></button></form>`]
  };
  const [modalTitle, content] = templates[type];
  title.textContent = modalTitle;
  body.innerHTML = content;
  modal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeAccountModal() {
  dashboard$("#accountModal").hidden = true;
  document.body.classList.remove("modal-open");
}

async function submitModalForm(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const type = form.dataset.modalForm;
  let endpoint = "", method = "POST", payload = data;
  if (type === "address") endpoint = "/api/account/addresses";
  if (type === "payment") endpoint = "/api/account/payment-methods";
  if (type === "preferences") { endpoint = "/api/account/preferences"; method = "PATCH"; payload = { order_updates: Boolean(data.order_updates), promotions: Boolean(data.promotions), product_news: Boolean(data.product_news) }; }
  if (type === "support") endpoint = "/api/account/support";
  if (type === "security") {
    if (data.new_password !== data.confirm_password) throw new Error("New passwords do not match.");
    endpoint = "/api/account/password"; method = "PATCH";
  }
  const response = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not save your changes.");
  await loadDashboard();
  closeAccountModal();
  const message = dashboard$("#dashboardMessage");
  message.textContent = type === "support" ? `Support request ${result.requestNumber} sent successfully.` : "Your account information was updated successfully.";
  message.className = "dashboard-message success";
}

dashboard$("#profileForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector("button[type='submit']");
  const message = dashboard$("#dashboardMessage");
  const name = dashboard$("#profileName").value.trim();
  const phone = dashboard$("#profilePhone").value.trim();
  if (name.length < 2) {
    message.textContent = "Please enter your full name.";
    message.className = "dashboard-message error";
    dashboard$("#profileName").focus();
    return;
  }
  if (phone && !/^[+\d().\s-]{7,30}$/.test(phone)) {
    message.textContent = "Please enter a valid phone number.";
    message.className = "dashboard-message error";
    dashboard$("#profilePhone").focus();
    return;
  }
  submitButton.disabled = true;
  submitButton.classList.add("is-saving");
  submitButton.innerHTML = "Saving changes…";
  message.textContent = "Saving your profile…";
  message.className = "dashboard-message";
  try {
    const response = await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, phone }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not save your profile.");
    accountData.user = result.user;
    dashboard$("#profileName").value = result.user.name;
    dashboard$("#profilePhone").value = result.user.phone || "";
    dashboard$("#profileAvatar").textContent = result.user.name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
    message.textContent = "Changes saved successfully.";
    message.className = "dashboard-message success";
  } catch (error) {
    message.textContent = error.message || "Could not save your profile. Please try again.";
    message.className = "dashboard-message error";
  } finally {
    submitButton.disabled = false;
    submitButton.classList.remove("is-saving");
    submitButton.innerHTML = "Save changes <span>→</span>";
  }
});

dashboard$("#logoutButton").addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login.html";
});

document.querySelectorAll("[data-account-action]").forEach(button => button.addEventListener("click", () => showAccountModal(button.dataset.accountAction)));
document.querySelectorAll("[data-close-account-modal]").forEach(element => element.addEventListener("click", closeAccountModal));
dashboard$("#accountModalBody").addEventListener("submit", async event => {
 if (!event.target.matches("[data-modal-form]")) return;
 event.preventDefault();
 try { await submitModalForm(event.target); }
 catch (error) {
   const message = dashboard$("#dashboardMessage");
   message.textContent = error.message;
   message.className = "dashboard-message error";
 }
});
dashboard$("#accountModalBody").addEventListener("click", async event => {
 const addressId = event.target.dataset.deleteAddress;
 const paymentId = event.target.dataset.deletePayment;
 if (!addressId && !paymentId) return;
 const endpoint = addressId ? `/api/account/addresses/${addressId}` : `/api/account/payment-methods/${paymentId}`;
 const response = await fetch(endpoint, { method: "DELETE" });
 if (response.ok) {
   await loadDashboard();
   showAccountModal(addressId ? "addresses" : "payments");
 }
});
document.addEventListener("keydown", event => { if (event.key === "Escape") closeAccountModal(); });

loadDashboard();
