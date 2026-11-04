
const form = document.getElementById("leaveForm");
const message = document.getElementById("message");
const submitButton = document.getElementById("submitButton");
const employeeDetails = document.getElementById("employeeDetails");
const logoutButton = document.getElementById("logoutButton");


// =====================================
// CHECK EMPLOYEE LOGIN
// =====================================

async function loadEmployeeDetails() {

    try {

        const response = await fetch("/api/employees/me", {
            credentials: "include"
        });

        if (response.status === 401) {
            window.location.href = "/login.html";
            return;
        }

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Unable to load employee details.");
        }

        const employee = result.employee;

        employeeDetails.innerHTML = `
            <p><strong>Name:</strong> ${escapeHTML(employee.full_name)}</p>
            <p><strong>Designation:</strong> ${escapeHTML(employee.designation)}</p>
        `;

        form.hidden = false;

    } catch (error) {

        console.error("Employee details error:", error);

        employeeDetails.textContent =
            "Unable to load your details. Please try again.";

    }

}


// Safely display employee details.
function escapeHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);

}


// =====================================
// SUBMIT LEAVE APPLICATION
// =====================================

form.addEventListener("submit", async (event) => {

    event.preventDefault();

    const data = {
        startDate: document.getElementById("startDate").value,
        endDate: document.getElementById("endDate").value,
        reason: document.getElementById("reason").value.trim()
    };

    message.textContent = "";

    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";

    try {

        const response = await fetch("/api/absences", {

            method: "POST",

            credentials: "include",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(data)

        });

        const result = await response.json();

        if (response.status === 401) {
            window.location.href = "/login.html";
            return;
        }

        if (!response.ok) {
            throw new Error(result.error || "Failed to submit leave.");
        }

        message.style.color = "green";
        message.textContent = result.message;

        form.reset();

        console.log("Saved leave record:", result.absence);

    } catch (error) {

        console.error("Leave submission error:", error);

        message.style.color = "red";

        message.textContent =
            error.message === "Failed to fetch"
                ? "Cannot connect to the backend. Check that the server is running."
                : error.message || "Failed to submit leave.";

    } finally {

        submitButton.disabled = false;
        submitButton.textContent = "Submit Leave Request";

    }

});


// =====================================
// EMPLOYEE LOGOUT
// =====================================

logoutButton.addEventListener("click", async () => {

    try {

        const response = await fetch("/api/employees/logout", {
            method: "POST",
            credentials: "include"
        });

        if (!response.ok) {
            throw new Error("Logout failed. Please try again.");
        }

        window.location.href = "/login.html";

    } catch (error) {

        message.style.color = "red";
        message.textContent = error.message;

    }

});


// Load employee details when the page opens.
loadEmployeeDetails();
