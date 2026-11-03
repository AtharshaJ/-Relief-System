const navigation = document.getElementById("workday-navigation");
const selectedDay = document.getElementById("selected-day");
const selectedDate = document.getElementById("selected-date");
const periodList = document.getElementById("period-list");
const message = document.getElementById("availability-message");
const todayButton = document.getElementById("today-button");

let selectedDateValue = "";
let workdays = [];

function localDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getNextFiveWorkdays(startDate = new Date()) {
    const days = [];
    const date = new Date(startDate);
    date.setHours(12, 0, 0, 0);

    while (days.length < 5) {
        const weekday = date.getDay();
        if (weekday !== 0 && weekday !== 6) { // Exclude weekends
            days.push({
                value: localDateString(date),
                dayName: date.toLocaleDateString("en-GB", { weekday: "long" }),
                shortName: date.toLocaleDateString("en-GB", { weekday: "short" }),
                displayDate: date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
            });
        }
        date.setDate(date.getDate() + 1);
    }
    return days;
}

function renderNavigation() {
    navigation.replaceChildren();
    workdays.forEach((day) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "workday-button";
        if (day.value === selectedDateValue) {
            button.classList.add("active");
        }

        const weekday = document.createElement("span");
        weekday.textContent = day.shortName;

        const dateText = document.createElement("strong");
        dateText.textContent = day.displayDate;

        button.append(weekday, dateText);
        button.addEventListener("click", () => {
            selectedDateValue = day.value;
            renderNavigation();
            loadAvailability(day);
        });
        navigation.appendChild(button);
    });
}

function addText(parent, tag, className, value) {
    const element = document.createElement(tag);
    if (className) {
        element.className = className;
    }
    element.textContent = value ?? "";
    parent.appendChild(element);
    return element;
}


function renderPeriods(periods, date) {
    periodList.replaceChildren();

    if (!periods || periods.length === 0) {
        addText(
            periodList,
            "p",
            "empty-message",
            "No timetable periods were found for this day."
        );
        return;
    }

    periods.forEach((period) => {
        const card = document.createElement("article");
        card.className = "period-card";

        // Period heading
        const heading = document.createElement("div");
        heading.className = "period-heading";

        addText(heading, "h3", "", `Period ${period.periodNo}`);

        card.appendChild(heading);

        // Relief assignments heading
        addText(
            card,
            "h4",
            "",
            `Relief Assignments (${period.reliefAssignments.length})`
        );

        // Display relief assignments
        if (period.reliefAssignments.length === 0) {

            addText(
                card,
                "p",
                "empty-message",
                "No approved-absence lessons identified."
            );

        } else {

            const lessonList = document.createElement("ul");

            period.reliefAssignments.forEach((lesson) => {
                const item = document.createElement("li");

                item.textContent =
                    `${lesson.class_name} — ${lesson.subject_name}
                    | Absent: ${lesson.absent_teacher}
                    | Assigned: ${lesson.assigned_teacher ?? "None"}
                    | Priority: ${lesson.priority}`;

                lessonList.appendChild(item);
            });

            card.appendChild(lessonList);
        }

        // View Free Teachers button
        const freeTeacherButton = document.createElement("button");

        freeTeacherButton.type = "button";
        freeTeacherButton.className = "view-free-teachers-btn";
        freeTeacherButton.textContent = "View Free Teachers";
        freeTeacherButton.setAttribute("aria-expanded", "false");

        card.appendChild(freeTeacherButton);

        // Container where free teacher names will appear
        const teacherContainer = document.createElement("div");

        teacherContainer.className = "teacher-list";
        teacherContainer.hidden = true;

        card.appendChild(teacherContainer);

        // Button click event
        freeTeacherButton.addEventListener("click", async () => {

            // If the list is already visible, hide it
            if (!teacherContainer.hidden) {
                teacherContainer.hidden = true;
                freeTeacherButton.setAttribute("aria-expanded", "false");
                return;
            }

            // Show the container
            teacherContainer.hidden = false;
            freeTeacherButton.setAttribute("aria-expanded", "true");

            // Avoid requesting the same data again
            if (teacherContainer.dataset.loaded === "true") {
                return;
            }

            await loadFreeTeachers(
                date,
                period.periodNo,
                teacherContainer,
                freeTeacherButton
            );
        });

        periodList.appendChild(card);
    });
}


async function loadFreeTeachers(date, periodNo, container, button) {

    button.disabled = true;
    button.textContent = "Loading teachers...";

    container.replaceChildren();

    try {

        const response = await fetch(
            `/api/availability/free-teachers?date=${encodeURIComponent(date)}&period=${encodeURIComponent(periodNo)}`
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "Could not load free teachers."
            );
        }

        if (!data.freeTeachers || data.freeTeachers.length === 0) {

            addText(
                container,
                "p",
                "empty-message",
                "No free teachers available for this period."
            );

        } else {

            addText(
                container,
                "h4",
                "",
                "Available Teachers"
            );

            data.freeTeachers.forEach((teacher) => {

                const teacherItem = document.createElement("div");

                teacherItem.className = "teacher-chip";
                teacherItem.textContent =
                    `${teacher.name} (${teacher.teacher_id})`;

                container.appendChild(teacherItem);
            });
        }

        // Remember that we have already loaded this list
        container.dataset.loaded = "true";

    } catch (error) {

        addText(
            container,
            "p",
            "empty-message",
            error.message === "Failed to fetch"
                ? "Cannot connect to the backend server."
                : error.message
        );

    } finally {

        button.disabled = false;
        button.textContent = "Hide Free Teachers";
    }
}


async function loadAvailability(day) {
    selectedDay.textContent = day.dayName;
    selectedDate.textContent = day.value;
    message.textContent = "Loading teacher availability...";
    periodList.replaceChildren();

    try {
        const response = await fetch(
            `/api/availability?date=${encodeURIComponent(day.value)}`
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Could not load availability.");
        }

        if (!data.periods || data.periods.length === 0) {
            message.textContent =
                "✅ No relief assignments are required. All scheduled classes are covered.";
            return;
        }

      renderPeriods(data.periods, day.value);

        message.textContent =
            `Showing relief allocations for ${day.dayName}.`;

    } catch (error) {
        message.textContent =
            error.message === "Failed to fetch"
                ? "Cannot connect to the backend server."
                : error.message;

        periodList.replaceChildren();
    }
}
function resetToToday() {
    workdays = getNextFiveWorkdays();
    selectedDateValue = localDateString(new Date());
    const today = workdays.find((day) => day.value === selectedDateValue);
    const selected = today || workdays[0];
    selectedDateValue = selected.value;
    renderNavigation();
    loadAvailability(selected);
}

todayButton.addEventListener("click", resetToToday);
resetToToday();
document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('uploadForm');
    
    if (uploadForm) {
        uploadForm.addEventListener('submit', async function(e) {
            e.preventDefault(); // Stop page from redirecting

            const formData = new FormData(this);
            const statusText = document.getElementById('uploadStatus');
            
            statusText.style.color = "blue";
            statusText.textContent = "Uploading and parsing timetable...";

            try {
                const response = await fetch('/api/timetable/import', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();

                if (response.ok) {
                    statusText.style.color = "green";
                    statusText.textContent =
    result.message || "Timetable imported successfully.";
                    const activeWorkday = workdays.find(d => d.value === selectedDateValue);
                    if (activeWorkday) {
                        loadAvailability(activeWorkday);
                    }
                
                    
                    // Optional: Call your function to reload/refresh the availability UI here
                    // e.g., loadAvailability(); 
                } else {
                    statusText.style.color = "red";
                    statusText.textContent = "Error: " + (result.message || result.error || "Unknown error");

                }
            } catch (err) {
                statusText.style.color = "red";
                statusText.textContent = "Network error occurred.";
            }
        });
    }
});