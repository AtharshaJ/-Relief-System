
const employeeForm = document.getElementById("employeeForm");

const designationInput = document.getElementById("designation");

const passwordInput = document.getElementById("password");

const confirmPasswordInput =
    document.getElementById("confirmPassword");

const formMessage = document.getElementById("formMessage");


// =====================================
// 1. GET DESIGNATION FROM PREVIOUS PAGE
// =====================================

const params = new URLSearchParams(window.location.search);

const selectedDesignation = params.get("designation");


// If no designation was selected, return to selection page.

if (!selectedDesignation || !selectedDesignation.trim()) {

    alert("Please select your designation first.");

    window.location.href = "employee-designation.html";

} else {

    designationInput.value = selectedDesignation;

}


// =====================================
// 2. PASSWORD MATCHING
// =====================================

confirmPasswordInput.addEventListener("input", () => {

    if (confirmPasswordInput.value !== passwordInput.value) {

        confirmPasswordInput.setCustomValidity(
            "Passwords do not match."
        );

    } else {

        confirmPasswordInput.setCustomValidity("");

    }

});


passwordInput.addEventListener("input", () => {

    // Recheck the confirmation whenever the password changes.

    if (confirmPasswordInput.value !== passwordInput.value) {

        confirmPasswordInput.setCustomValidity(
            "Passwords do not match."
        );

    } else {

        confirmPasswordInput.setCustomValidity("");

    }

});


// =====================================
// 3. HANDLE FORM SUBMISSION
// =====================================


// =====================================
// 3. HANDLE FORM SUBMISSION
// =====================================

employeeForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    formMessage.textContent = "";

    // Check that both passwords match.
    if (passwordInput.value !== confirmPasswordInput.value) {

        formMessage.textContent = "Passwords do not match.";
        confirmPasswordInput.focus();
        return;

    }

    // Collect employee details.
   
// Collect employee details.
const employeeData = {

    designation: selectedDesignation,

    fullName: document.getElementById("fullName").value.trim(),

    trId: document.getElementById("trId").value.trim(),

    contactNumber:
        document.getElementById("contactNumber").value.trim(),

    shortName:
        document.getElementById("shortName").value.trim(),

    // Employment information
    firstAppointmentDate:
        document.getElementById("firstAppointmentDate").value,

    // Initial annual leave usage for 2026
    dutyLeaveDays:
        Number(document.getElementById("dutyLeaveDays").value),

    sickLeaveDays:
        Number(document.getElementById("sickLeaveDays").value),

    casualLeaveDays:
        Number(document.getElementById("casualLeaveDays").value),

    username:
        document.getElementById("username").value.trim(),

    password: passwordInput.value

};

    try {

        formMessage.style.color = "#087477";
        formMessage.textContent = "Creating your account...";

        const response = await fetch("/api/employees/register", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            credentials: "same-origin",

            body: JSON.stringify(employeeData)

        });

        const result = await response.json();

        if (!response.ok) {

            throw new Error(
                result.error || "Registration failed."
            );

        }

        formMessage.style.color = "#087477";

        formMessage.textContent =
            "Account created successfully! Redirecting to login...";

        employeeForm.reset();

        setTimeout(() => {
            window.location.href = "login.html";
        }, 2000);

    } catch (error) {

        console.error("Registration error:", error);

        formMessage.style.color = "#c0392b";

        formMessage.textContent = error.message;

    }

});

