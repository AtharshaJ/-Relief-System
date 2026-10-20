const container = document.getElementById("leaveContainer");
const buttons = document.querySelectorAll(".filter");
let currentStatus = "Pending";

// Initial load
loadLeaves(currentStatus);

buttons.forEach(button => {
    button.addEventListener("click", () => {
        buttons.forEach(btn => btn.classList.remove("active"));
        button.classList.add("active");
        currentStatus = button.dataset.status;
        loadLeaves(currentStatus);
    });
});

async function loadLeaves(status) {
    try {
        const response = await fetch(`http://localhost:5000/api/leave?status=${status}`);
        const leaves = await response.json();
        container.innerHTML = "";

        if (leaves.length === 0) {
            container.innerHTML = "<p>No leave applications found.</p>";
            return;
        }

        leaves.forEach(leave => {
            const card = document.createElement("div");
            card.className = "leave-card";
            
            const formattedDate = leave.leave_date ? leave.leave_date.split('T')[0] : "N/A";

            card.innerHTML = `
                <div class="leave-summary" onclick="toggleCard(this)">
                    <h3 class="teacher-name">${leave.teacher_name}</h3>
                    <span class="status ${leave.status.toLowerCase()}">${leave.status}</span>
                </div>
                <div class="leave-details" style="display: none;">
                    <p><strong>Reason:</strong> ${leave.reason || "None"}</p>
                    <p><strong>Leave Date:</strong> ${formattedDate}</p>
                    <div class="actions">
                        <button class="approve-btn" onclick="updateStatus(${leave.id}, 'Approved')">Approve</button>
                        <button class="reject-btn" onclick="updateStatus(${leave.id}, 'Rejected')">Reject</button>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });

    } catch (error) {
        console.error("Error loading leaves:", error);
    }
}

// Function to expand/collapse card details when clicked
function toggleCard(headerElement) {
    const details = headerElement.nextElementSibling;
    if (details.style.display === "none") {
        details.style.display = "block";
    } else {
        details.style.display = "none";
    }
}

async function updateStatus(id, status) {
    try {
        await fetch(`http://localhost:5000/api/leave/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status })
        });
        loadLeaves(currentStatus);
    } catch (error) {
        console.error("Error updating status:", error);
    }
}