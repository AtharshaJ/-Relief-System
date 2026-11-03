
const designationForm = document.getElementById("designationForm");

const otherDesignationGroup = document.getElementById("otherDesignationGroup");

const otherDesignationInput = document.getElementById("otherDesignation");

const formMessage = document.getElementById("formMessage");


// =====================================
// 1. SHOW OR HIDE OTHER DESIGNATION
// =====================================

designationForm.addEventListener("change", (event) => {

    // Check whether a designation radio button changed.
    if (event.target.name !== "designation") {
        return;
    }

    const isOther = event.target.value === "Other";

    // Show the input only when Other is selected.
    otherDesignationGroup.hidden = !isOther;

    // Make the input compulsory when Other is selected.
    otherDesignationInput.required = isOther;

    // Clear the previous custom designation.
    if (!isOther) {
        otherDesignationInput.value = "";
    }

    formMessage.textContent = "";

});


// =====================================
// 2. HANDLE CONTINUE BUTTON
// =====================================

designationForm.addEventListener("submit", (event) => {

    // Prevent normal form submission.
    event.preventDefault();

    formMessage.textContent = "";


    // Get the selected designation.
    const selected = designationForm.querySelector(
        'input[name="designation"]:checked'
    );


    // Check whether the user selected anything.
    if (!selected) {

        formMessage.textContent =
            "Please select your designation to continue.";

        return;
    }


    let designation = selected.value;


    // If Other is selected, get the custom designation.
    if (designation === "Other") {

        designation = otherDesignationInput.value.trim();

        if (!designation) {

            formMessage.textContent =
                "Please enter your designation.";

            otherDesignationInput.focus();

            return;
        }

    }


    // Navigate to the next page.
    // Carry the selected designation through the URL.

    const nextPage = new URL(
        "employee-registration.html",
        window.location.href
    );

    nextPage.searchParams.set("designation", designation);

    window.location.href = nextPage.toString();

});
