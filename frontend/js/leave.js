
const form = document.getElementById("leaveForm");
const message = document.getElementById("message");
const submitButton = document.getElementById("submitButton");
const employeeDetails = document.getElementById("employeeDetails");
const logoutButton = document.getElementById("logoutButton");

const startDateInput = document.getElementById("startDate");
const endDateInput = document.getElementById("endDate");
const leaveDaysInput = document.getElementById("leaveDays");

const endDateGroup = document.getElementById("endDateGroup");
const leaveDaysGroup = document.getElementById("leaveDaysGroup");
const selectedLeaveType = document.getElementById("selectedLeaveType");

// =====================================
// GET SELECTED LEAVE TYPE
// =====================================

const urlParams = new URLSearchParams(window.location.search);
const leaveType = urlParams.get("type");

const leaveTypes = {
    medical: "Medical Leave",
    duty: "Duty Leave",
    casual: "Casual Leave"
};

if (!leaveTypes[leaveType]) {
    window.location.href = "/leave-type.html";
} else {
    selectedLeaveType.textContent =
        "Selected Leave Type: " + leaveTypes[leaveType];

    if (leaveType === "medical") {

        // Medical leave is submitted one day at a time.
        endDateGroup.hidden = true;
        leaveDaysGroup.hidden = true;

        endDateInput.required = false;
        leaveDaysInput.required = false;
        leaveDaysInput.value = 1;

    } else {

        // Duty and casual leave require a date range and day count.
        endDateGroup.hidden = false;
        leaveDaysGroup.hidden = false;

        endDateInput.required = true;
        leaveDaysInput.required = true;
    }
}

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
            throw new Error(
                result.error || "Unable to load employee details."
            );
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

// =====================================
// SAFELY DISPLAY EMPLOYEE DETAILS
// =====================================

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

    const startDate = startDateInput.value;
    const endDate = leaveType === "medical"
        ? startDate
        : endDateInput.value;

    const leaveDays = leaveType === "medical"
        ? 1
        : Number(leaveDaysInput.value);

    if (!startDate) {
        message.style.color = "red";
        message.textContent = "Please select the leave date.";
        return;
    }

    if (leaveType !== "medical" && !endDate) {
        message.style.color = "red";
        message.textContent = "Please select the resuming date.";
        return;
    }

    if (leaveType !== "medical" && endDate < startDate) {
        message.style.color = "red";
        message.textContent =
            "Resuming date cannot be before the starting date.";
        return;
    }

    if (!Number.isFinite(leaveDays) || leaveDays <= 0) {
        message.style.color = "red";
        message.textContent = "Please enter a valid number of leave days.";
        return;
    }

    const data = {
        leaveType,
        startDate,
        endDate,
        leaveDays,
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

        if (leaveType === "medical") {
            leaveDaysInput.value = 1;
        }

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

// =====================================
// LOAD EMPLOYEE DETAILS
// =====================================

if (leaveTypes[leaveType]) {
    loadEmployeeDetails();
}
