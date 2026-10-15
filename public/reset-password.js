const params = new URLSearchParams(window.location.search);
const token = params.get("token") || "";
const form = document.querySelector("#resetForm");
const message = document.querySelector("#resetMessage");
const submit = form.querySelector("button");

form.addEventListener("submit", async event => {
  event.preventDefault();
  const password = document.querySelector("#resetPassword").value;
  const confirm = document.querySelector("#resetConfirm").value;
  if (!token) { message.textContent = "This reset link is missing."; message.className = "dashboard-message error"; return; }
  if (password !== confirm) { message.textContent = "Passwords do not match."; message.className = "dashboard-message error"; return; }
  submit.disabled = true;
  submit.textContent = "Updating password…";
  try {
    const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not update password.");
    message.textContent = "Password updated. You can now sign in.";
    message.className = "dashboard-message success";
    form.reset();
    submit.textContent = "Password updated";
  } catch (error) {
    message.textContent = error.message;
    message.className = "dashboard-message error";
    submit.disabled = false;
    submit.innerHTML = "Update password <span>→</span>";
  }
});
