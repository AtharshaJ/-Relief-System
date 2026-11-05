const form = document.getElementById("leaveForm");
const message = document.getElementById("message");
const submitButton = document.getElementById("submitButton");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const data = {
        teacherId: document.getElementById("teacherId").value.trim(),
        startDate: document.getElementById("startDate").value,
        endDate: document.getElementById("endDate").value
    };

    // Validate date range
    if (data.endDate < data.startDate) {
        message.style.color = "red";
        message.textContent = "End date cannot be before start date.";
        return;
    }

    message.textContent = "";

    submitButton.disabled = true;
    submitButton.textContent = "Registering...";

    try {
        const response = await fetch("/api/absences", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error || "Failed to register leave."
            );
        }

        message.style.color = "green";
        message.textContent = result.message;

        form.reset();

        console.log("Saved leave record:", result.absence);

    } catch (error) {
        console.error("Leave registration error:", error);

        message.style.color = "red";

        message.textContent =
            error.message === "Failed to fetch"
                ? "Cannot connect to the backend. Check your connection."
                : error.message || "Failed to register leave.";

    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Submit Leave Registration";
    }
});