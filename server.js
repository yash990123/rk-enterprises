const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");
const { URL } = require("url");
const nodemailer = require("nodemailer");

const port = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "public");
const database = new DatabaseSync(path.join(__dirname, "computer-hub.db"));
const adminEmail = String(process.env.ADMIN_EMAIL || "yash990123@gmail.com").trim().toLowerCase();
const appUrl = String(process.env.APP_URL || `http://localhost:${port}`).replace(/\/$/, "");
const smtpTransport = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
      auth: { user: process.env.SMTP_USER, pass: String(process.env.SMTP_PASS).replace(/\s/g, "") }
    })
  : null;
const mailFrom = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@rk-enterprises.local";

database.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'customer',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT NOT NULL UNIQUE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    items_json TEXT NOT NULL,
    total REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'Processing',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    recipient TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    line1 TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS payment_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    brand TEXT NOT NULL,
    last4 TEXT NOT NULL,
    expiry_month INTEGER NOT NULL,
    expiry_year INTEGER NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS communication_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    order_updates INTEGER NOT NULL DEFAULT 1,
    promotions INTEGER NOT NULL DEFAULT 1,
    product_news INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS support_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Open',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    used_at INTEGER
  );
`);

try { database.exec("ALTER TABLE users ADD COLUMN phone TEXT NOT NULL DEFAULT ''"); } catch {}
try { database.exec("ALTER TABLE addresses ADD COLUMN phone TEXT NOT NULL DEFAULT ''"); } catch {}
try { database.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'customer'"); } catch {}
if (adminEmail) database.prepare("UPDATE users SET role = 'admin' WHERE lower(email) = ?").run(adminEmail);

const products = [
  {
    id: 1,
    name: "Nebula X1 Gaming PC",
    category: "Desktops",
    price: 1499,
    oldPrice: 1699,
    rating: 4.9,
    reviews: 128,
    badge: "Best seller",
    description: "Ryzen 7 7800X3D · RTX 4070 SUPER · 32GB DDR5 · 1TB NVMe",
    image: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=900&q=85",
    colors: ["#5d5fef", "#f3f4f6"]
  },
  {
    id: 2,
    name: "AeroBook Pro 14",
    category: "Laptops",
    price: 1199,
    oldPrice: 1299,
    rating: 4.8,
    reviews: 86,
    badge: "New",
    description: "Intel Core Ultra 7 · 14” OLED · 16GB RAM · 1TB SSD",
    image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=85",
    colors: ["#0e7490", "#111827"]
  },
  {
    id: 3,
    name: "Pulse Mechanical 75",
    category: "Accessories",
    price: 129,
    oldPrice: 159,
    rating: 4.7,
    reviews: 214,
    badge: "Popular",
    description: "Hot-swap switches · RGB lighting · Wireless + USB-C",
    image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=85",
    colors: ["#f97316", "#1f2937"]
  },
  {
    id: 4,
    name: "Vision 27 4K Monitor",
    category: "Monitors",
    price: 449,
    oldPrice: 499,
    rating: 4.8,
    reviews: 72,
    badge: "Top rated",
    description: "4K UHD · 144Hz · HDR600 · USB-C 90W power delivery",
    image: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=900&q=85",
    colors: ["#111827", "#e5e7eb"]
  },
  {
    id: 5,
    name: "Flux Wireless Mouse",
    category: "Accessories",
    price: 69,
    oldPrice: 79,
    rating: 4.6,
    reviews: 301,
    badge: "",
    description: "26K DPI sensor · 80-hour battery · Ergonomic right-hand fit",
    image: "https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=900&q=85",
    colors: ["#0f172a", "#a855f7"]
  },
  {
    id: 6,
    name: "Studio Mini M3",
    category: "Desktops",
    price: 799,
    oldPrice: 899,
    rating: 4.9,
    reviews: 94,
    badge: "Editor's pick",
    description: "12-core processor · 16GB unified memory · 512GB SSD",
    image: "https://images.unsplash.com/photo-1625842268584-8f3296236761?auto=format&fit=crop&w=900&q=85",
    colors: ["#d1d5db", "#111827"]
  }
];

function send(res, status, data, type = "application/json") {
  res.writeHead(status, { "Content-Type": `${type}; charset=utf-8` });
  res.end(type === "application/json" ? JSON.stringify(data) : data);
}

function readCookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").filter(Boolean).map(cookie => {
    const separator = cookie.indexOf("=");
    return [cookie.slice(0, separator).trim(), decodeURIComponent(cookie.slice(separator + 1).trim())];
  }));
}

function currentUser(req) {
  const token = readCookies(req).computer_hub_session;
  if (!token) return null;
  const row = database.prepare(`
    SELECT users.id, users.name, users.email, users.phone, users.role
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ? AND sessions.expires_at > ?
  `).get(token, Date.now());
  return row || null;
}

function setSession(res, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  database.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, Date.now() + 1000 * 60 * 60 * 24 * 30);
  res.setHeader("Set-Cookie", `computer_hub_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`);
}

function clearSession(req, res) {
  const token = readCookies(req).computer_hub_session;
  if (token) database.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  res.setHeader("Set-Cookie", "computer_hub_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
}

function passwordHash(password, salt = crypto.randomBytes(16).toString("hex")) {
  return {
    salt,
    hash: crypto.scryptSync(password, salt, 64).toString("hex")
  };
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function sendPasswordResetEmail(email, rawToken) {
  if (!smtpTransport) throw new Error("SMTP email delivery is not configured.");
  const resetUrl = `${appUrl}/reset-password.html?token=${encodeURIComponent(rawToken)}`;
  return smtpTransport.sendMail({
    from: mailFrom,
    to: email,
    subject: "Reset your RK ENTERPRISES password",
    text: `We received a request to reset your RK ENTERPRISES password.\n\nOpen this link within 30 minutes:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#17201f"><h2>Reset your RK ENTERPRISES password</h2><p>We received a request to reset your password.</p><p><a href="${resetUrl}" style="display:inline-block;padding:12px 18px;background:#88decc;color:#03080b;text-decoration:none;border-radius:6px">Reset password</a></p><p>This link expires in 30 minutes and can be used once. If you did not request this, you can ignore this email.</p></div>`
  });
}

function safeUser(user) {
  return user ? { id: user.id, name: user.name, email: user.email, phone: user.phone || "", role: user.role || "customer" } : null;
}

function requireAdmin(req, res) {
  const user = currentUser(req);
  if (!user) {
    send(res, 401, { error: "Please sign in to access the admin panel." });
    return null;
  }
  if (user.role !== "admin") {
    send(res, 403, { error: "Admin access is required." });
    return null;
  }
  return user;
}

function parseBody(req, callback) {
  let body = "";
  req.on("data", chunk => { body += chunk; });
  req.on("end", () => {
    try { callback(null, JSON.parse(body || "{}")); }
    catch { callback(new Error("Invalid JSON payload.")); }
  });
}

function serveStatic(req, res) {
  const requested = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const relative = requested === "/" ? "index.html" : requested.replace(/^\/+/, "");
  const filePath = path.resolve(publicDir, relative);
  if (!filePath.startsWith(publicDir)) return send(res, 403, { error: "Forbidden" });
  fs.readFile(filePath, (error, file) => {
    if (error) {
      if (requested !== "/") return fs.readFile(path.join(publicDir, "index.html"), (fallbackError, fallback) => {
        if (fallbackError) return send(res, 404, { error: "Not found" });
        send(res, 200, fallback, "text/html");
      });
      return send(res, 404, { error: "Not found" });
    }
    const ext = path.extname(filePath);
    const contentTypes = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json" };
    send(res, 200, file, contentTypes[ext] || "application/octet-stream");
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true, service: "rk-enterprises" });
  if (req.method === "GET" && url.pathname === "/api/products") return send(res, 200, products);
  if (req.method === "GET" && url.pathname === "/api/auth/me") return send(res, 200, { user: safeUser(currentUser(req)) });
  if (req.method === "GET" && url.pathname === "/api/admin/overview") {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const totals = database.prepare(`
      SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM orders) AS orders,
        (SELECT COALESCE(SUM(total), 0) FROM orders) AS revenue,
        (SELECT COUNT(*) FROM orders WHERE status = 'Processing') AS processing_orders,
        (SELECT COUNT(*) FROM orders WHERE status = 'Shipped') AS shipped_orders,
        (SELECT COUNT(*) FROM orders WHERE status = 'Delivered') AS delivered_orders
    `).get();
    const users = database.prepare(`
      SELECT users.id, users.name, users.email, users.phone, users.role, users.created_at,
        COUNT(orders.id) AS order_count, COALESCE(SUM(orders.total), 0) AS order_total
      FROM users LEFT JOIN orders ON orders.user_id = users.id
      GROUP BY users.id ORDER BY users.id DESC
    `).all();
    const orders = database.prepare(`
      SELECT orders.id, orders.order_number, orders.email, orders.total, orders.status, orders.created_at,
        users.name AS customer_name
      FROM orders LEFT JOIN users ON users.id = orders.user_id
      ORDER BY orders.id DESC LIMIT 100
    `).all();
    return send(res, 200, { admin: safeUser(admin), totals, users, orders, statuses: ["Processing", "Packed", "Shipped", "Out for delivery", "Delivered"] });
  }
  if (req.method === "PATCH" && url.pathname.startsWith("/api/admin/orders/")) {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const orderId = Number(url.pathname.split("/").pop());
    return parseBody(req, async (error, body) => {
      if (error) return send(res, 400, { error: error.message });
      const statuses = ["Processing", "Packed", "Shipped", "Out for delivery", "Delivered"];
      const status = String(body.status || "");
      if (!statuses.includes(status)) return send(res, 400, { error: "Choose a valid order status." });
      const result = database.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, orderId);
      if (!result.changes) return send(res, 404, { error: "Order not found." });
      return send(res, 200, { ok: true, status });
    });
  }
  if (req.method === "POST" && url.pathname.startsWith("/api/admin/users/") && url.pathname.endsWith("/password-reset")) {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const userId = Number(url.pathname.split("/")[4]);
    const target = database.prepare("SELECT id, email FROM users WHERE id = ?").get(userId);
    if (!target) return send(res, 404, { error: "User not found." });
    const rawToken = crypto.randomBytes(32).toString("hex");
    database.prepare("DELETE FROM password_reset_tokens WHERE user_id = ? OR expires_at <= ?").run(userId, Date.now());
    database.prepare("INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(tokenHash(rawToken), userId, Date.now() + 1000 * 60 * 30);
    try {
      await sendPasswordResetEmail(target.email, rawToken);
    } catch (mailError) {
      database.prepare("DELETE FROM password_reset_tokens WHERE token_hash = ?").run(tokenHash(rawToken));
      console.error("Admin password reset email failed:", mailError.message);
      return send(res, 503, { error: "Password reset email is temporarily unavailable. Configure SMTP and try again." });
    }
    return send(res, 201, { expiresInMinutes: 30, email: target.email });
  }
  if (req.method === "POST" && url.pathname === "/api/auth/reset-password") {
    return parseBody(req, async (error, body) => {
      if (error) return send(res, 400, { error: error.message });
      const token = String(body.token || "");
      const password = String(body.password || "");
      if (!token || password.length < 8) return send(res, 400, { error: "Use a valid reset link and a password with at least 8 characters." });
      const reset = database.prepare("SELECT user_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?").get(tokenHash(token), Date.now());
      if (!reset) return send(res, 400, { error: "This reset link is invalid or has expired." });
      const hashed = passwordHash(password);
      database.prepare("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?").run(hashed.hash, hashed.salt, reset.user_id);
      database.prepare("UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ?").run(Date.now(), tokenHash(token));
      database.prepare("DELETE FROM sessions WHERE user_id = ?").run(reset.user_id);
      return send(res, 200, { ok: true });
    });
  }
  if (req.method === "POST" && url.pathname === "/api/auth/request-password-reset") {
    return parseBody(req, async (error, body) => {
      if (error) return send(res, 400, { error: error.message });
      const email = String(body.email || "").trim().toLowerCase();
      if (!email.includes("@")) return send(res, 400, { error: "Enter the email address used for your account." });
      const user = database.prepare("SELECT id, email FROM users WHERE email = ?").get(email);
      if (!user) return send(res, 200, { ok: true, message: "If an account exists for that email, a reset link has been sent." });
      const rawToken = crypto.randomBytes(32).toString("hex");
      database.prepare("DELETE FROM password_reset_tokens WHERE user_id = ? OR expires_at <= ?").run(user.id, Date.now());
      database.prepare("INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(tokenHash(rawToken), user.id, Date.now() + 1000 * 60 * 30);
      try {
        await sendPasswordResetEmail(user.email, rawToken);
      } catch (mailError) {
        database.prepare("DELETE FROM password_reset_tokens WHERE token_hash = ?").run(tokenHash(rawToken));
        console.error("Password reset email failed:", mailError.message);
        return send(res, 503, { error: "Password reset email is temporarily unavailable. Please try again later." });
      }
      return send(res, 200, { ok: true, message: "If an account exists for that email, a reset link has been sent." });
    });
  }
  if (req.method === "GET" && url.pathname === "/api/account") {
    const user = currentUser(req);
    if (!user) return send(res, 401, { error: "Please sign in to view your account." });
    const orders = database.prepare("SELECT order_number, total, status, created_at FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 20").all(user.id);
    const addresses = database.prepare("SELECT id, label, recipient, phone, line1, city, state, postal_code, is_default FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC").all(user.id);
    const paymentMethods = database.prepare("SELECT id, brand, last4, expiry_month, expiry_year, is_default FROM payment_methods WHERE user_id = ? ORDER BY is_default DESC, id DESC").all(user.id);
    let preferences = database.prepare("SELECT order_updates, promotions, product_news FROM communication_preferences WHERE user_id = ?").get(user.id);
    if (!preferences) {
      database.prepare("INSERT INTO communication_preferences (user_id) VALUES (?)").run(user.id);
      preferences = { order_updates: 1, promotions: 1, product_news: 0 };
    }
    return send(res, 200, { user: safeUser(user), orders, addresses, paymentMethods, preferences });
  }
  if (req.method === "PATCH" && url.pathname === "/api/account") {
    const user = currentUser(req);
    if (!user) return send(res, 401, { error: "Please sign in to update your account." });
    return parseBody(req, (error, body) => {
      if (error) return send(res, 400, { error: error.message });
      const name = String(body.name || "").trim();
      const phone = String(body.phone || "").trim();
      if (name.length < 2) return send(res, 400, { error: "Please enter your full name." });
      if (phone && !/^[+\d().\s-]{7,30}$/.test(phone)) return send(res, 400, { error: "Please enter a valid phone number." });
      database.prepare("UPDATE users SET name = ?, phone = ? WHERE id = ?").run(name, phone, user.id);
      return send(res, 200, { user: safeUser({ ...user, name, phone }) });
    });
  }
  if (req.method === "POST" && url.pathname === "/api/account/addresses") {
    const user = currentUser(req);
    if (!user) return send(res, 401, { error: "Please sign in to manage addresses." });
    return parseBody(req, (error, body) => {
      if (error) return send(res, 400, { error: error.message });
      const values = ["label", "recipient", "phone", "line1", "city", "state", "postal_code"].map(key => String(body[key] || "").trim());
      if (values.some(value => !value)) return send(res, 400, { error: "Complete every address field." });
      if (!/^[+\d().\s-]{7,30}$/.test(values[2])) return send(res, 400, { error: "Please enter a valid billing phone number." });
      const isDefault = body.is_default ? 1 : 0;
      if (isDefault) database.prepare("UPDATE addresses SET is_default = 0 WHERE user_id = ?").run(user.id);
      database.prepare("INSERT INTO addresses (user_id, label, recipient, phone, line1, city, state, postal_code, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(user.id, ...values, isDefault);
      return send(res, 201, { ok: true });
    });
  }
  if (req.method === "DELETE" && url.pathname.startsWith("/api/account/addresses/")) {
    const user = currentUser(req);
    if (!user) return send(res, 401, { error: "Please sign in to manage addresses." });
    const id = Number(url.pathname.split("/").pop());
    database.prepare("DELETE FROM addresses WHERE id = ? AND user_id = ?").run(id, user.id);
    return send(res, 200, { ok: true });
  }
  if (req.method === "POST" && url.pathname === "/api/account/payment-methods") {
    const user = currentUser(req);
    if (!user) return send(res, 401, { error: "Please sign in to manage payment methods." });
    return parseBody(req, (error, body) => {
      if (error) return send(res, 400, { error: error.message });
      const brand = String(body.brand || "").trim();
      const digits = String(body.number || "").replace(/\D/g, "");
      const month = Number(body.expiry_month);
      const year = Number(body.expiry_year);
      if (!brand || digits.length < 12 || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < new Date().getFullYear()) {
        return send(res, 400, { error: "Enter a valid card brand, number, and expiry date." });
      }
      const isDefault = body.is_default ? 1 : 0;
      if (isDefault) database.prepare("UPDATE payment_methods SET is_default = 0 WHERE user_id = ?").run(user.id);
      database.prepare("INSERT INTO payment_methods (user_id, brand, last4, expiry_month, expiry_year, is_default) VALUES (?, ?, ?, ?, ?, ?)").run(user.id, brand, digits.slice(-4), month, year, isDefault);
      return send(res, 201, { ok: true });
    });
  }
  if (req.method === "DELETE" && url.pathname.startsWith("/api/account/payment-methods/")) {
    const user = currentUser(req);
    if (!user) return send(res, 401, { error: "Please sign in to manage payment methods." });
    const id = Number(url.pathname.split("/").pop());
    database.prepare("DELETE FROM payment_methods WHERE id = ? AND user_id = ?").run(id, user.id);
    return send(res, 200, { ok: true });
  }
  if (req.method === "PATCH" && url.pathname === "/api/account/preferences") {
    const user = currentUser(req);
    if (!user) return send(res, 401, { error: "Please sign in to update preferences." });
    return parseBody(req, (error, body) => {
      if (error) return send(res, 400, { error: error.message });
      database.prepare(`INSERT INTO communication_preferences (user_id, order_updates, promotions, product_news)
        VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET order_updates=excluded.order_updates, promotions=excluded.promotions, product_news=excluded.product_news`)
        .run(user.id, body.order_updates ? 1 : 0, body.promotions ? 1 : 0, body.product_news ? 1 : 0);
      return send(res, 200, { ok: true });
    });
  }
  if (req.method === "POST" && url.pathname === "/api/account/support") {
    const user = currentUser(req);
    if (!user) return send(res, 401, { error: "Please sign in to contact support." });
    return parseBody(req, (error, body) => {
      if (error) return send(res, 400, { error: error.message });
      const subject = String(body.subject || "").trim();
      const message = String(body.message || "").trim();
      if (subject.length < 3 || message.length < 10) return send(res, 400, { error: "Please provide a subject and a detailed message." });
      const result = database.prepare("INSERT INTO support_requests (user_id, subject, message) VALUES (?, ?, ?)").run(user.id, subject, message);
      return send(res, 201, { ok: true, requestNumber: `RK-${String(result.lastInsertRowid).padStart(6, "0")}` });
    });
  }
  if (req.method === "PATCH" && url.pathname === "/api/account/password") {
    const user = currentUser(req);
    if (!user) return send(res, 401, { error: "Please sign in to change your password." });
    return parseBody(req, (error, body) => {
      if (error) return send(res, 400, { error: error.message });
      const record = database.prepare("SELECT password_hash, password_salt FROM users WHERE id = ?").get(user.id);
      const currentHash = passwordHash(String(body.current_password || ""), record.password_salt).hash;
      if (!crypto.timingSafeEqual(Buffer.from(currentHash), Buffer.from(record.password_hash))) return send(res, 400, { error: "Current password is incorrect." });
      const next = String(body.new_password || "");
      if (next.length < 8) return send(res, 400, { error: "New password must be at least 8 characters." });
      const hashed = passwordHash(next);
      database.prepare("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?").run(hashed.hash, hashed.salt, user.id);
      return send(res, 200, { ok: true });
    });
  }
  if (req.method === "POST" && url.pathname === "/api/auth/register") {
    return parseBody(req, (error, body) => {
      if (error) return send(res, 400, { error: error.message });
      const name = String(body.name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (name.length < 2 || !email.includes("@") || password.length < 8) {
        return send(res, 400, { error: "Use a name, a valid email, and a password with at least 8 characters." });
      }
      try {
        const { salt, hash } = passwordHash(password);
        const result = database.prepare("INSERT INTO users (name, email, password_hash, password_salt) VALUES (?, ?, ?, ?)").run(name, email, hash, salt);
        setSession(res, result.lastInsertRowid);
        return send(res, 201, { user: { name, email } });
      } catch (insertError) {
        if (String(insertError.message).includes("UNIQUE")) return send(res, 409, { error: "An account with that email already exists." });
        return send(res, 500, { error: "Could not create your account." });
      }
    });
  }
  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    return parseBody(req, (error, body) => {
      if (error) return send(res, 400, { error: error.message });
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const user = database.prepare("SELECT * FROM users WHERE email = ?").get(email);
      const attemptedHash = user ? passwordHash(password, user.password_salt).hash : "";
      if (!user || !crypto.timingSafeEqual(Buffer.from(attemptedHash), Buffer.from(user.password_hash))) {
        return send(res, 401, { error: "Email or password is incorrect." });
      }
      setSession(res, user.id);
      return send(res, 200, { user: safeUser(user) });
    });
  }
  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    clearSession(req, res);
    return send(res, 200, { ok: true });
  }
  if (req.method === "POST" && url.pathname === "/api/orders") {
    return parseBody(req, (error, order) => {
      if (error) return send(res, 400, { error: error.message });
      const user = currentUser(req);
      if (!order.email || !Array.isArray(order.items) || order.items.length === 0) {
        return send(res, 400, { error: "Please provide an email and at least one item." });
      }
      const total = order.items.reduce((sum, item) => {
        const product = products.find(candidate => candidate.id === Number(item.id));
        return sum + (product ? product.price * Math.max(1, Number(item.quantity) || 1) : 0);
      }, 0);
      const orderNumber = `CH-${Date.now().toString().slice(-6)}`;
      database.prepare("INSERT INTO orders (order_number, user_id, email, items_json, total) VALUES (?, ?, ?, ?, ?)").run(orderNumber, user ? user.id : null, String(order.email).trim().toLowerCase(), JSON.stringify(order.items), total);
      return send(res, 201, { ok: true, orderNumber });
    });
  }
  if (req.method === "GET" && url.pathname === "/admin.html") {
    if (!requireAdmin(req, res)) return;
    return serveStatic(req, res);
  }
  serveStatic(req, res);
});

server.listen(port, () => console.log(`RK ENTERPRISES is running at http://localhost:${port}`));
