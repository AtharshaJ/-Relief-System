
const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");
const loginButton = document.getElementById("loginButton");

loginForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    message.textContent = "";

    loginButton.disabled = true;
    loginButton.textContent = "Logging in...";

    try {

        const response = await fetch("/api/employees/login", {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username,
                password
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Login failed.");
        }

        message.style.color = "green";
        message.textContent = "Login successful! Redirecting...";

        window.location.href = "/leave.html";

    } catch (error) {

        console.error("Login error:", error);

        message.style.color = "red";
        message.textContent =
            error.message === "Failed to fetch"
                ? "Cannot connect to the server. Please try again."
                : error.message;

    } finally {

        loginButton.disabled = false;
        loginButton.textContent = "Login";

    }

});
