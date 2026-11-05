
const employeeDetails = document.getElementById("employeeDetails");
const message = document.getElementById("message");
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
            throw new Error(
                result.error || "Unable to load employee details."
            );
        }

        const employee = result.employee;

        employeeDetails.innerHTML = `
            <p><strong>Name:</strong> ${escapeHTML(employee.full_name)}</p>
            <p><strong>Designation:</strong> ${escapeHTML(employee.designation)}</p>
        `;

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
// SELECT LEAVE TYPE
// =====================================

const leaveTypeButtons = document.querySelectorAll(
    ".leave-type-card"
);

leaveTypeButtons.forEach(button => {

    button.addEventListener("click", () => {

        const leaveType = button.dataset.leaveType;

        const validTypes = [
            "medical",
            "duty",
            "casual"
        ];

        if (!validTypes.includes(leaveType)) {
            message.textContent = "Invalid leave type selected.";
            return;
        }

        window.location.href =
            `/leave.html?type=${encodeURIComponent(leaveType)}`;

    });

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

loadEmployeeDetails();
