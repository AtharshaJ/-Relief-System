const express = require("express");
const router = express.Router();
const pool = require("../db");

router.get("/availability", async (req, res) => {
    try {
        const { date } = req.query;

        // 1. Validate date format (YYYY-MM-DD)
        if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ error: "Please provide a valid date in YYYY-MM-DD format." });
        }

        const selectedDate = new Date(date + "T00:00:00Z");
        if (Number.isNaN(selectedDate.getTime()) || selectedDate.toISOString().slice(0, 10) !== date) {
            return res.status(400).json({ error: "Invalid calendar date." });
        }

        // 2. Determine weekday name
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const dayName = dayNames[selectedDate.getUTCDay()];

        // 3. Handle weekends
        if (dayName === "Saturday" || dayName === "Sunday") {
            return res.json({
                date,
                dayName,
                periods: [],
                message: "The selected date is not a school working day."
            });
        }

        // 4. Check if relief allocations are ALREADY saved for this specific date
        const existingReliefQuery = await pool.query(
            `SELECT r.*, tr1.name as absent_teacher_name, tr2.name as assigned_teacher_name
             FROM relief_allocations r
             LEFT JOIN teachers tr1 ON r.absent_teacher_id = tr1.teacher_id
             LEFT JOIN teachers tr2 ON r.assigned_teacher_id = tr2.teacher_id
             WHERE r.allocation_date = $1::date
             ORDER BY r.period_no, r.class_name`,
            [date]
        );

        // If already generated for this date, group and return them directly
        if (existingReliefQuery.rows.length > 0) {
            const savedRows = existingReliefQuery.rows;
            const periodMap = new Map();

            savedRows.forEach(row => {
                if (!periodMap.has(row.period_no)) {
                    periodMap.set(row.period_no, []);
                }
                periodMap.get(row.period_no).push({
                    class_name: row.class_name,
                    subject_name: row.subject_name,
                    absent_teacher: row.absent_teacher_name || row.absent_teacher_id,
                    assigned_teacher: row.assigned_teacher_name || row.assigned_teacher_id,
                    priority: row.priority
                });
            });

            const periods = [...periodMap.entries()].map(([periodNo, reliefAssignments]) => ({
                periodNo,
                reliefAssignments,
                freeTeachers: [] // Can be populated if needed
            }));

            return res.json({ date, dayName, periods, source: "database_cache" });
        }

        // 5. If NOT saved yet, calculate them dynamically:
        // Fetch teachers on approved leave for this date
        const absencesResult = await pool.query(
            `SELECT DISTINCT teacher_id
             FROM absences
             WHERE LOWER(TRIM(status)) = 'approved'
               AND startdate <= $1::date
               AND enddate >= $1::date`,
            [date]
        );
        const absentTeacherIds = new Set(absencesResult.rows.map(row => String(row.teacher_id)));

        // Fetch all timetable slots for this day where an absent teacher is assigned
        const timetableResult = await pool.query(
            `SELECT t.id, t.class_name, t.day_name, t.period_no, t.subject_name, t.teacher_id, tr.name as teacher_name
             FROM timetable t
             JOIN teachers tr ON t.teacher_id = tr.teacher_id
             WHERE LOWER(TRIM(t.day_name)) = LOWER($1)
             ORDER BY t.period_no, t.class_name`,
            [dayName]
        );

        const allLessons = timetableResult.rows;
        const periodMap = new Map();
        allLessons.forEach(lesson => {
            if (!periodMap.has(lesson.period_no)) {
                periodMap.set(lesson.period_no, []);
            }
            periodMap.get(lesson.period_no).push(lesson);
        });

        const periodNumbers = [...periodMap.keys()].sort((a, b) => a - b);
        const periods = [];

        for (const periodNo of periodNumbers) {
            const periodLessons = periodMap.get(periodNo);
            const reliefNeeded = periodLessons.filter(lesson => absentTeacherIds.has(String(lesson.teacher_id)));

            if (reliefNeeded.length === 0) {
                continue;
            }

            // Fetch free teachers for this period
            const freeTeachersResult = await pool.query(
                `SELECT f.teacher_id, tr.name
                 FROM freeperiods f
                 JOIN teachers tr ON f.teacher_id = tr.teacher_id
                 WHERE LOWER(TRIM(f.day_name)) = LOWER($1) AND f.period_no = $2`,
                [dayName, periodNo]
            );

            let availableFreeTeachers = freeTeachersResult.rows.filter(
                t => !absentTeacherIds.has(String(t.teacher_id))
            );

            const usedReliefTeacherIds = new Set();
            const reliefAssignments = [];

            for (const lesson of reliefNeeded) {
                let eligibleTeachers = availableFreeTeachers.filter(
                    t => !usedReliefTeacherIds.has(t.teacher_id)
                );

                let assignedTeacher = null;
                let priorityMatch = "No Teacher Available";

                if (eligibleTeachers.length > 0) {
                    // Priority 1: Check teacher_class table for a teacher linked to this class
                    const sameClassMatchQuery = await pool.query(
                        `SELECT tc.teacher_id, tr.name 
                         FROM teacher_class tc
                         JOIN teachers tr ON tc.teacher_id = tr.teacher_id
                         WHERE tc.class_name = $1 AND tc.teacher_id = ANY($2::text[])
                         LIMIT 1`,
                        [lesson.class_name, eligibleTeachers.map(t => t.teacher_id)]
                    );

                    if (sameClassMatchQuery.rows.length > 0) {
                        assignedTeacher = sameClassMatchQuery.rows[0];
                        priorityMatch = "Same Class";
                    } else {
                        // Priority 2: Fallback to any available free teacher
                        assignedTeacher = eligibleTeachers[0];
                        priorityMatch = "Any Available Teacher";
                    }

                    usedReliefTeacherIds.add(assignedTeacher.teacher_id);
                }

                // Save allocation into `relief_allocations` table permanently for the week
                await pool.query(
                    `INSERT INTO relief_allocations 
                        (allocation_date, day_name, period_no, class_name, subject_name, absent_teacher_id, assigned_teacher_id, priority)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [
                        date,
                        dayName,
                        periodNo,
                        lesson.class_name,
                        lesson.subject_name,
                        lesson.teacher_id,
                        assignedTeacher ? assignedTeacher.teacher_id : 'UNASSIGNED',
                        priorityMatch
                    ]
                );

                reliefAssignments.push({
                    class_name: lesson.class_name,
                    subject_name: lesson.subject_name,
                    absent_teacher: lesson.teacher_name,
                    assigned_teacher: assignedTeacher ? assignedTeacher.name : null,
                    priority: priorityMatch
                });
            }

            periods.push({
                periodNo,
                reliefAssignments,
                freeTeachers: availableFreeTeachers
            });
        }

        return res.json({
            date,
            dayName,
            periods,
            source: "newly_allocated"
        });

    } catch (error) {
        console.error("Availability error:", error);
        res.status(500).json({ error: "Unable to load teacher availability." });
    }
});

module.exports = router;