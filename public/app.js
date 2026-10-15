const state = { products: [], category: "All", query: "", sort: "featured", cart: JSON.parse(localStorage.getItem("computer-hub-cart") || "[]") };
const $ = selector => document.querySelector(selector);
const money = value => `$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

async function init() {
  const response = await fetch("/api/products");
  state.products = await response.json();
  renderProducts();
  renderCart();
  await renderAccount();
  bindEvents();
}

async function renderAccount() {
  const response = await fetch("/api/auth/me");
  const result = await response.json();
  const accountLink = $("#accountLink");
  const accountName = $("#accountName");
  if (result.user) {
    accountName.textContent = `Hi, ${result.user.name.split(" ")[0]}`;
    accountLink.href = "/dashboard.html";
    accountLink.title = `Signed in as ${result.user.email}. Click to manage your account.`;
    accountLink.classList.add("signed-in");
  }
}

function visibleProducts() {
  let list = state.products.filter(product => {
    const matchesCategory = state.category === "All" || product.category === state.category;
    const haystack = `${product.name} ${product.category} ${product.description}`.toLowerCase();
    return matchesCategory && haystack.includes(state.query.toLowerCase());
  });
  if (state.sort === "low") list.sort((a, b) => a.price - b.price);
  if (state.sort === "high") list.sort((a, b) => b.price - a.price);
  if (state.sort === "rating") list.sort((a, b) => b.rating - a.rating);
  return list;
}

function renderProducts() {
  const products = visibleProducts();
  $("#productGrid").innerHTML = products.map(product => `
    <article class="product-card">
      <div class="product-image">
        <img src="${product.image}" alt="${product.name}" loading="lazy" />
        ${product.badge ? `<span class="product-badge">${product.badge}</span>` : ""}
        <button class="quick-add" data-add="${product.id}" aria-label="Add ${product.name} to cart">+</button>
      </div>
      <div class="product-info">
        <span class="product-category">${product.category}</span>
        <h3 class="product-name">${product.name}</h3>
        <p class="product-desc">${product.description}</p>
        <div class="product-bottom"><div class="price">${money(product.price)} <span class="old-price">${money(product.oldPrice)}</span></div><div class="rating"><span>★</span>${product.rating} (${product.reviews})</div></div>
      </div>
    </article>`).join("");
  $("#emptyState").hidden = products.length > 0;
}

function saveCart() {
  localStorage.setItem("computer-hub-cart", JSON.stringify(state.cart));
  renderCart();
}

function addToCart(id) {
  const existing = state.cart.find(item => item.id === id);
  if (existing) existing.quantity += 1;
  else state.cart.push({ id, quantity: 1 });
  saveCart();
  openCart();
}

function renderCart() {
  const detailed = state.cart.map(item => ({ ...item, product: state.products.find(product => product.id === item.id) })).filter(item => item.product);
  const count = detailed.reduce((total, item) => total + item.quantity, 0);
  const subtotal = detailed.reduce((total, item) => total + item.product.price * item.quantity, 0);
  $(".cart-count").textContent = count;
  $("#drawerCount").textContent = `(${count})`;
  $("#cartSubtotal").textContent = money(subtotal);
  $("#checkoutTotal").textContent = money(subtotal);
  $("#cartItems").innerHTML = detailed.map(item => `
    <div class="cart-row">
      <img src="${item.product.image}" alt="${item.product.name}" />
      <div class="cart-row-info"><strong>${item.product.name}</strong><small>${money(item.product.price)}</small>
        <div class="quantity"><button data-decrease="${item.id}" aria-label="Decrease quantity">−</button><span>${item.quantity}</span><button data-increase="${item.id}" aria-label="Increase quantity">+</button><button class="remove-item" data-remove="${item.id}">Remove</button></div>
      </div>
    </div>`).join("");
  $("#cartEmpty").style.display = count ? "none" : "block";
  $("#cartFooter").style.display = count ? "block" : "none";
}

function openCart() { $("#cartDrawer").classList.add("open"); $("#overlay").classList.add("open"); }
function closeCart() { $("#cartDrawer").classList.remove("open"); $("#overlay").classList.remove("open"); }

function bindEvents() {
  document.addEventListener("click", event => {
    const add = event.target.closest("[data-add]");
    if (add) addToCart(Number(add.dataset.add));
    const category = event.target.closest("[data-category]");
    if (category) {
      event.preventDefault();
      state.category = category.dataset.category;
      document.querySelectorAll("[data-category]").forEach(el => el.classList.toggle("active", el.dataset.category === state.category));
      renderProducts();
      $("#shop").scrollIntoView({ behavior: "smooth", block: "start" });
    }
    const increase = event.target.closest("[data-increase]");
    if (increase) { state.cart.find(item => item.id === Number(increase.dataset.increase)).quantity += 1; saveCart(); }
    const decrease = event.target.closest("[data-decrease]");
    if (decrease) {
      const item = state.cart.find(item => item.id === Number(decrease.dataset.decrease));
      item.quantity -= 1;
      if (item.quantity <= 0) state.cart = state.cart.filter(cartItem => cartItem.id !== item.id);
      saveCart();
    }
    const remove = event.target.closest("[data-remove]");
    if (remove) { state.cart = state.cart.filter(item => item.id !== Number(remove.dataset.remove)); saveCart(); }
  });
  $("#cartOpen").addEventListener("click", openCart);
  $("#cartClose").addEventListener("click", closeCart);
  $("#cartEmptyClose").addEventListener("click", closeCart);
  $("#overlay").addEventListener("click", closeCart);
  $("#searchToggle").addEventListener("click", () => { $("#searchBar").classList.toggle("open"); $("#searchInput").focus(); });
  $("#searchClose").addEventListener("click", () => $("#searchBar").classList.remove("open"));
  $("#searchInput").addEventListener("input", event => { state.query = event.target.value; renderProducts(); });
  $("#sortSelect").addEventListener("change", event => { state.sort = event.target.value; renderProducts(); });
  document.querySelectorAll(".checkout-trigger").forEach(button => button.addEventListener("click", () => {
    closeCart();
    $("#checkoutModal").classList.add("open");
  }));
  $("#checkoutClose").addEventListener("click", () => $("#checkoutModal").classList.remove("open"));
  $("#checkoutModal").addEventListener("click", event => { if (event.target === $("#checkoutModal")) $("#checkoutModal").classList.remove("open"); });
  $("#checkoutForm").addEventListener("submit", submitOrder);
  $("#newsletterForm").addEventListener("submit", event => { event.preventDefault(); $("#newsletterMessage").textContent = "You're on the list — welcome to the hub."; event.target.reset(); });
}

async function submitOrder(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), email: form.get("email"), address: form.get("address"), items: state.cart }) });
  const result = await response.json();
  if (!response.ok) return;
  $("#checkoutContent").innerHTML = `<div class="success-message"><div class="success-icon">✓</div><p class="eyebrow">Order confirmed</p><h2>You're all set.</h2><p>Thanks for shopping with us. Your order <strong>${result.orderNumber}</strong> is being prepared and we'll send tracking details to ${form.get("email")}.</p><button class="button button-primary" id="doneButton">Back to shopping <span>→</span></button></div>`;
  state.cart = [];
  saveCart();
  $("#doneButton").addEventListener("click", () => { $("#checkoutModal").classList.remove("open"); window.scrollTo({ top: 0, behavior: "smooth" }); });
}

init();
