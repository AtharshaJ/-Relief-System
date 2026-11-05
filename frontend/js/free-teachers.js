const navigation = document.getElementById("workday-navigation");
const selectedDay = document.getElementById("selected-day");
const selectedDate = document.getElementById("selected-date");
const periodList = document.getElementById("period-list");
const message = document.getElementById("availability-message");
const todayButton = document.getElementById("today-button");
const downloadReportButton = document.getElementById("download-report-button");
let teacherSearchRequestId = 0;

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

    periods.forEach(period => {

        const card = document.createElement("article");
        card.className = "period-card";

        // Period heading
        const heading = document.createElement("div");
        heading.className = "period-heading";

        addText(heading, "h3", "", `Period ${period.periodNo}`);

        card.appendChild(heading);

        // Relief assignments
        const assignments = period.reliefAssignments || [];

        addText(
            card,
            "h4",
            "",
            `Relief Assignments (${assignments.length})`
        );

        if (assignments.length === 0) {

            addText(
                card,
                "p",
                "empty-message",
                "No approved-absence lessons identified."
            );

        } else {

            assignments.forEach(lesson => {

                const lessonCard = document.createElement("div");
                lessonCard.className = "lesson-card";

                addText(
                    lessonCard,
                    "h4",
                    "",
                    `${lesson.class_name} — ${lesson.subject_name}`
                );

                addText(
                    lessonCard,
                    "p",
                    "",
                    `Absent: ${lesson.absent_teacher}`
                );

                addText(
                    lessonCard,
                    "p",
                    "",
                    `Assigned: ${lesson.assigned_teacher ?? "None"}`
                );

                addText(
                    lessonCard,
                    "p",
                    "",
                    `Priority: ${lesson.priority}`
                );

                // Change Teacher button
                const changeButton = document.createElement("button");

                changeButton.type = "button";
                changeButton.className = "change-teacher-btn";
                changeButton.textContent = "Change Teacher";

                lessonCard.appendChild(changeButton);

                // Search area
                const searchContainer = document.createElement("div");

                searchContainer.className = "manual-search-container";
                searchContainer.hidden = true;

                lessonCard.appendChild(searchContainer);

                changeButton.addEventListener("click", () => {

                    searchContainer.hidden = !searchContainer.hidden;

                    if (searchContainer.hidden) {
                        changeButton.textContent = "Change Teacher";
                        return;
                    }

                    changeButton.textContent = "Close Search";

                    showTeacherSearch(
                        date,
                        period.periodNo,
                        lesson.id,
                        searchContainer
                    );
                });

                card.appendChild(lessonCard);
            });
        }

        // View Free Teachers button (preserved)
        const freeTeacherButton = document.createElement("button");

        freeTeacherButton.type = "button";
        freeTeacherButton.className = "view-free-teachers-btn";
        freeTeacherButton.textContent = "View Free Teachers";
        freeTeacherButton.setAttribute("aria-expanded", "false");

        card.appendChild(freeTeacherButton);

        const teacherContainer = document.createElement("div");

        teacherContainer.className = "teacher-list";
        teacherContainer.hidden = true;

        card.appendChild(teacherContainer);

        freeTeacherButton.addEventListener("click", async () => {

            if (!teacherContainer.hidden) {

                teacherContainer.hidden = true;
                freeTeacherButton.setAttribute("aria-expanded", "false");
                freeTeacherButton.textContent = "View Free Teachers";

                return;
            }

            teacherContainer.hidden = false;

            freeTeacherButton.setAttribute("aria-expanded", "true");
            freeTeacherButton.textContent = "Hide Free Teachers";

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

// Download daily relief report
downloadReportButton.addEventListener("click", () => {

    if (!selectedDateValue) {
        alert("Please select a date first.");
        return;
    }

    const reportUrl =
        `/api/daily-report?date=${encodeURIComponent(selectedDateValue)}`;

    window.open(reportUrl, "_blank");
});

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

async function searchTeachers(
    query,
    date,
    periodNo,
    allocationId,
    resultsContainer,
    onTeacherSelected
) {
    const requestId = ++teacherSearchRequestId;

    if (!query.trim()) {
        resultsContainer.replaceChildren();
        return;
    }

    resultsContainer.replaceChildren();

    addText(
        resultsContainer,
        "p",
        "search-message",
        "Searching teachers..."
    );

    try {
        const params = new URLSearchParams({
            date,
            period: periodNo,
            q: query.trim(),
            allocationId
        });

        const response = await fetch(
            `/api/availability/search-teachers?${params.toString()}`
        );

        const data = await response.json();

        if (requestId !== teacherSearchRequestId) {
            return;
        }

        if (!response.ok) {
            throw new Error(data.error || "Teacher search failed.");
        }

        resultsContainer.replaceChildren();

        if (!data.teachers || data.teachers.length === 0) {
            addText(
                resultsContainer,
                "p",
                "empty-message",
                "No matching teacher IDs found."
            );
            return;
        }

        data.teachers.forEach(teacher => {

            const teacherOption = document.createElement("button");

            teacherOption.type = "button";
            teacherOption.className = "teacher-search-result";

            addText(
                teacherOption,
                "strong",
                "",
                teacher.teacher_id
            );

            addText(
                teacherOption,
                "span",
                "",
                teacher.name
            );

            const status = addText(
                teacherOption,
                "span",
                "availability-status",
                teacher.availability_status
            );

            status.classList.add(
                "status-" + teacher.availability_status
                    .toLowerCase()
                    .replaceAll(" ", "-")
            );

            teacherOption.addEventListener("click", () => {
                onTeacherSelected(teacher);
            });

            resultsContainer.appendChild(teacherOption);
        });

    } catch (error) {

        if (requestId !== teacherSearchRequestId) {
            return;
        }

        resultsContainer.replaceChildren();

        addText(
            resultsContainer,
            "p",
            "empty-message",
            error.message === "Failed to fetch"
                ? "Cannot connect to the backend server."
                : error.message
        );
    }
}

function showTeacherSearch(date, periodNo, allocationId, container) {

    container.replaceChildren();

    let selectedTeacher = null;

    // Teacher ID input
    const searchInput = document.createElement("input");

    searchInput.type = "text";
    searchInput.placeholder = "Enter Teacher ID...";
    searchInput.className = "teacher-search-input";
    searchInput.autocomplete = "off";

    container.appendChild(searchInput);

    // Search results
    const resultsContainer = document.createElement("div");

    resultsContainer.className = "teacher-search-results";

    container.appendChild(resultsContainer);

    // Selected teacher information
    const selectedContainer = document.createElement("div");

    selectedContainer.className = "selected-teacher";

    container.appendChild(selectedContainer);

    // Save button
    const saveButton = document.createElement("button");

    saveButton.type = "button";
    saveButton.className = "save-assignment-btn";
    saveButton.textContent = "Save Assignment";
    saveButton.hidden = true;

    container.appendChild(saveButton);

    let searchTimer;

    // Search as the admin types
    searchInput.addEventListener("input", () => {

        clearTimeout(searchTimer);

        selectedTeacher = null;
        selectedContainer.replaceChildren();
        saveButton.hidden = true;

        const query = searchInput.value.trim();

        searchTimer = setTimeout(() => {

            searchTeachers(
                query,
                date,
                periodNo,
                allocationId,
                resultsContainer,
                (teacher) => {

                    selectedTeacher = teacher;

                    resultsContainer.replaceChildren();
                    selectedContainer.replaceChildren();

                    addText(
                        selectedContainer,
                        "p",
                        "",
                        `Selected: ${teacher.teacher_id} - ${teacher.name}`
                    );

                    addText(
                        selectedContainer,
                        "p",
                        "availability-status",
                        `Status: ${teacher.availability_status}`
                    );

                    if (teacher.availability_status !== "Available") {
                        addText(
                            selectedContainer,
                            "p",
                            "warning-message",
                            "Warning: This teacher may have a scheduling conflict. Please verify before confirming."
                        );
                    }

                    saveButton.hidden = false;
                }
            );

        }, 250);
    });

    // Save manually selected teacher
    saveButton.addEventListener("click", async () => {

        if (!selectedTeacher) {
            return;
        }

        const hasConflict =
            selectedTeacher.availability_status !== "Available";

        const confirmationMessage = hasConflict
            ? `Warning: ${selectedTeacher.teacher_id} is marked as "${selectedTeacher.availability_status}". Do you still want to assign this teacher?`
            : `Assign ${selectedTeacher.teacher_id} to this relief lesson?`;

        if (!confirm(confirmationMessage)) {
            return;
        }

        saveButton.disabled = true;
        saveButton.textContent = "Saving...";

        try {

            const response = await fetch(
                "/api/availability/assign",
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        allocationId,
                        teacherId: selectedTeacher.teacher_id
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || "Failed to save assignment."
                );
            }

            alert(data.message);

            // Refresh the selected day's dashboard
            const activeDay = workdays.find(
                day => day.value === date
            );

            if (activeDay) {
                await loadAvailability(activeDay);
            }

        } catch (error) {

            alert(error.message);

        } finally {

            saveButton.disabled = false;
            saveButton.textContent = "Save Assignment";
        }
    });

    searchInput.focus();
}