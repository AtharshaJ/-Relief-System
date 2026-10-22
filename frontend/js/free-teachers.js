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

function renderPeriods(periods) {
    periodList.replaceChildren();

    if (!periods || periods.length === 0) {
        addText(periodList, "p", "empty-message", "No timetable periods were found for this day.");
        return;
    }

    periods.forEach((period) => {
        const card = document.createElement("article");
        card.className = "period-card";

        const heading = document.createElement("div");
        heading.className = "period-heading";
        addText(heading, "h3", "", `Period ${period.periodNo}`);
        addText(heading, "span", "period-count", `${period.freeTeachers.length} free`);
        card.appendChild(heading);

        addText(card, "h4", "", `Relief Assignments (${period.reliefAssignments.length})`);
        if (period.reliefAssignments.length === 0) {
            addText(card, "p", "empty-message", "No approved-absence lessons identified.");
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

        addText(card, "h4", "", "Available teachers");
        if (period.freeTeachers.length === 0) {
            addText(card, "p", "empty-message", "No free teachers found for this period.");
        } else {
            const teacherList = document.createElement("div");
            teacherList.className = "teacher-list";
            period.freeTeachers.forEach((teacher) => {
                const chip = document.createElement("span");
                chip.className = "teacher-chip";
                chip.textContent = teacher.name;
                teacherList.appendChild(chip);
            });
            card.appendChild(teacherList);
        }

        periodList.appendChild(card);
    });
}

async function loadAvailability(day) {
    selectedDay.textContent = day.dayName;
    selectedDate.textContent = day.value;
    message.textContent = "Loading teacher availability...";
    periodList.replaceChildren();

    try {
        const response = await fetch(`http://localhost:5000/api/availability?date=${encodeURIComponent(day.value)}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Could not load availability.");
        }

        renderPeriods(data.periods);
        message.textContent = data.message || `Showing timetable and availability for ${data.dayName}.`;
    } catch (error) {
        message.textContent = error.message === "Failed to fetch" 
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
                    statusText.textContent = resultText; 
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