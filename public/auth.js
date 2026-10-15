const authState = { mode: "login" };
const auth$ = selector => document.querySelector(selector);
let forgotMode = false;

function updateAuthMode(mode) {
  authState.mode = mode;
  const register = mode === "register";
  document.querySelectorAll(".auth-tab, .auth-switch button").forEach(button => {
    if (button.dataset.mode) button.classList.toggle("active", button.dataset.mode === mode);
  });
  auth$("#nameField").hidden = !register;
  auth$("#nameField input").required = register;
  auth$("#authEyebrow").textContent = register ? "Join the community" : "Welcome back";
  auth$("#authTitle").textContent = register ? "Create your account" : "Sign in to your account";
  auth$("#authSubtitle").textContent = register ? "Save your favorites and checkout faster." : "Enter your details to continue shopping.";
  auth$("#authSubmit").innerHTML = `${register ? "Create account" : "Sign in"} <span>→</span>`;
  auth$("#authSwitch").innerHTML = register
    ? 'Already have an account? <button data-mode="login">Sign in</button>'
    : 'New to RK ENTERPRISES? <button data-mode="register">Create an account</button>';
}

document.addEventListener("click", event => {
  const modeButton = event.target.closest("[data-mode]");
  if (modeButton) { event.preventDefault(); updateAuthMode(modeButton.dataset.mode); }
  if (event.target.id === "forgotLink") {
    event.preventDefault();
    const email = auth$("#authForm input[name=email]").value;
    forgotMode = true;
    auth$("#authEyebrow").textContent = "Account recovery";
    auth$("#authTitle").textContent = "Forgot your password?";
    auth$("#authSubtitle").textContent = "Enter your email and we’ll create a secure reset link.";
    auth$("#nameField").hidden = true;
    auth$("#authForm").innerHTML = `
      <label>Email address<input name="email" type="email" autocomplete="email" required placeholder="you@example.com" /></label>
      <p class="auth-error" id="authError" role="alert"></p>
      <button class="button button-primary auth-submit" type="submit" id="authSubmit">Create reset link <span>→</span></button>
      <button class="auth-back-action" type="button" id="backToLogin">← Back to sign in</button>`;
    auth$("#authForm input[name=email]").value = email;
    auth$("#authSwitch").textContent = "Your account remains protected.";
  }
  if (event.target.id === "backToLogin") {
    event.preventDefault();
    forgotMode = false;
    auth$("#authForm").innerHTML = `
      <label id="nameField" hidden>Full name<input name="name" autocomplete="name" placeholder="Alex Morgan" /></label>
      <label>Email address<input name="email" type="email" autocomplete="email" required placeholder="you@example.com" /></label>
      <label>Password<input name="password" type="password" autocomplete="current-password" required minlength="8" placeholder="At least 8 characters" /></label>
      <div class="auth-options"><label class="checkbox-label"><input type="checkbox" /> Remember me</label><a href="#" id="forgotLink">Forgot password?</a></div>
      <p class="auth-error" id="authError" role="alert"></p>
      <button class="button button-primary auth-submit" type="submit" id="authSubmit">Sign in <span>→</span></button>`;
    updateAuthMode("login");
  }
});

auth$("#authForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = new FormData(event.target);
  if (forgotMode) {
    const submit = auth$("#authSubmit");
    const error = auth$("#authError");
    submit.disabled = true;
    submit.textContent = "Creating reset link…";
    error.textContent = "";
    try {
      const response = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email") })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create a reset link.");
      error.className = "auth-success";
      error.textContent = result.message;
      submit.textContent = "Email sent";
    } catch (requestError) {
      error.className = "auth-error";
      error.textContent = requestError.message || "Could not create a reset link.";
      submit.disabled = false;
      submit.innerHTML = "Create reset link <span>→</span>";
    }
    return;
  }
  const payload = { email: form.get("email"), password: form.get("password") };
  if (authState.mode === "register") payload.name = form.get("name");
  auth$("#authError").textContent = "";
  auth$("#authSubmit").disabled = true;
  try {
    const response = await fetch(`/api/auth/${authState.mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 409 && authState.mode === "register") {
        const email = String(form.get("email") || "").trim();
        updateAuthMode("login");
        auth$("#authForm input[name=email]").value = email;
        auth$("#authError").innerHTML = 'This email already has an account. <button type="button" class="inline-auth-action" data-mode="login">Sign in instead</button>.';
      } else {
        auth$("#authError").textContent = result.error || "Something went wrong. Please try again.";
      }
      return;
    }
    const action = authState.mode === "register" ? "Account created" : "Signed in";
    const returnTarget = new URLSearchParams(window.location.search).get("return");
    const continueHref = returnTarget && returnTarget.startsWith("/") ? returnTarget : "/";
    auth$("#authForm").innerHTML = `
      <div class="auth-success-panel">
        <div class="success-icon">✓</div>
        <p class="eyebrow">${action}</p>
        <h3>${authState.mode === "register" ? "Welcome to RK ENTERPRISES." : "Welcome back."}</h3>
        <p>Your account is ready. You can continue shopping or return to the account page.</p>
        <a class="button button-primary" href="${continueHref}">${returnTarget === "/dashboard.html" ? "Open account" : "Continue shopping"} <span>→</span></a>
      </div>`;
    auth$("#authSwitch").textContent = "You are securely signed in.";
  } catch {
    auth$("#authError").textContent = "The server is unavailable. Please try again.";
  } finally {
    auth$("#authSubmit").disabled = false;
  }
});
