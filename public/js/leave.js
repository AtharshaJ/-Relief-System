
const form = document.getElementById("leaveForm");
const message = document.getElementById("message");
const submitButton = document.getElementById("submitButton");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const data = {
        teacherId: document.getElementById("teacherId").value,
        startDate: document.getElementById("startDate").value,
        endDate: document.getElementById("endDate").value,
        reason: document.getElementById("reason").value.trim()
    };

    message.textContent = "";
    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";

    try {
        const response = await fetch(
            "/api/absences",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data)
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error || "Failed to submit leave."
            );
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
