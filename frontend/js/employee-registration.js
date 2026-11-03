
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

employeeForm.addEventListener("submit", (event) => {

    event.preventDefault();

    formMessage.textContent = "";


    // Check that both passwords match.

    if (passwordInput.value !== confirmPasswordInput.value) {

        formMessage.textContent = "Passwords do not match.";

        confirmPasswordInput.focus();

        return;

    }


    // Collect employee details.

    const employeeData = {

        designation: selectedDesignation,

        fullName: document.getElementById("fullName").value.trim(),

        trId: document.getElementById("trId").value.trim(),

        contactNumber:
            document.getElementById("contactNumber").value.trim(),

        

        shortName:
            document.getElementById("shortName").value.trim(),

        username:
            document.getElementById("username").value.trim(),

        password: passwordInput.value

    };


    // Temporary test output.
    // We will connect this form to PostgreSQL through
    // the backend in the next stage.

    console.log("Employee registration details:", {
        ...employeeData,
        password: "[HIDDEN]"
    });


    formMessage.style.color = "#087477";

    formMessage.textContent =
        "Form validation successful! Backend registration is the next step.";

});
