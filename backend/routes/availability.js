
const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireLogin } = require("../middleware/authMiddleware");

// GET availability and relief assignments for a selected date
router.get("/availability", async (req, res) => {
    try {
        const { date } = req.query;

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({
                error: "A valid date is required (YYYY-MM-DD)."
            });
        }

        // Get the weekday name, e.g. Monday
        const selectedDate = new Date(`${date}T12:00:00`);

        if (Number.isNaN(selectedDate.getTime())) {
            return res.status(400).json({
                error: "Invalid date."
            });
        }

        const dayName = selectedDate.toLocaleDateString(
            "en-US",
            { weekday: "long" }
        );

        // STEP 1: Find all periods for this weekday
        // Include periods even if they have no relief assignments.
        const periodsResult = await pool.query(
            `SELECT period_no FROM timetable
             WHERE LOWER(TRIM(day_name)) = LOWER(TRIM($1))

             UNION

             SELECT period_no FROM freeperiods
             WHERE LOWER(TRIM(day_name)) = LOWER(TRIM($1))

             UNION

             SELECT period_no FROM relief_allocations
             WHERE allocation_date = $2

             ORDER BY period_no`,
            [dayName, date]
        );

        // STEP 2: Get relief assignments for the selected date
        const result = await pool.query(
            `SELECT
                r.*,
                tr1.name AS absent_teacher_name,
                tr2.name AS assigned_teacher_name
             FROM relief_allocations r
             LEFT JOIN teachers tr1
                ON tr1.teacher_id = r.absent_teacher_id
             LEFT JOIN teachers tr2
                ON tr2.teacher_id = r.assigned_teacher_id
             WHERE r.allocation_date = $1
             ORDER BY r.period_no, r.class_name`,
            [date]
        );

        // STEP 3: Create an object for every period
        const groupedPeriods = {};

        periodsResult.rows.forEach(row => {
            groupedPeriods[row.period_no] = {
                periodNo: row.period_no,
                reliefAssignments: []
            };
        });

        // STEP 4: Add relief assignments to their periods
        result.rows.forEach(row => {

            // Also create the period if an allocation exists
            // but it wasn't found in the other tables.
            if (!groupedPeriods[row.period_no]) {
                groupedPeriods[row.period_no] = {
                    periodNo: row.period_no,
                    reliefAssignments: []
                };
            }

           groupedPeriods[row.period_no].reliefAssignments.push({
    id: row.id,
    class_name: row.class_name,
    subject_name: row.subject_name,
    absent_teacher: row.absent_teacher_name,
    assigned_teacher: row.assigned_teacher_name,
    priority: row.priority
});
        });

        // STEP 5: Send the periods to the frontend
        res.json({
            date,
            periods: Object.values(groupedPeriods)
        });

    } catch (err) {
        console.error("Availability error:", err);

        res.status(500).json({
            error: "Failed to load availability."
        });
    }
});


// GET free teachers for a particular date and period
router.get("/availability/free-teachers", async (req, res) => {
    try {
        const { date, period } = req.query;

        // Validate date
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({
                error: "A valid date is required."
            });
        }

        // Validate period number
        const periodNo = Number(period);

        if (!Number.isInteger(periodNo) || periodNo < 1) {
            return res.status(400).json({
                error: "A valid period number is required."
            });
        }

        const selectedDate = new Date(`${date}T12:00:00`);

        if (Number.isNaN(selectedDate.getTime())) {
            return res.status(400).json({
                error: "Invalid date."
            });
        }

        const dayName = selectedDate.toLocaleDateString(
            "en-US",
            { weekday: "long" }
        );

        // Find teachers who are free and not already assigned
        const result = await pool.query(
            `SELECT DISTINCT
                f.teacher_id,
                tr.name
             FROM freeperiods f
             JOIN teachers tr
                ON tr.teacher_id = f.teacher_id

             WHERE LOWER(TRIM(f.day_name)) = LOWER(TRIM($1))
             AND f.period_no = $2

             -- Exclude teachers with approved leave on this date
             AND NOT EXISTS (
                 SELECT 1
                 FROM absences a
                 WHERE a.teacher_id = f.teacher_id
AND LOWER(TRIM(a.status)) IN ('approved', 'registered')
                 AND a.startdate <= $3::date
                 AND a.enddate >= $3::date
             )

             -- Exclude teachers already assigned to relief
             -- during this date and period
             AND NOT EXISTS (
                 SELECT 1
                 FROM relief_allocations r
                 WHERE r.allocation_date = $3
                 AND r.period_no = $2
                 AND r.assigned_teacher_id = f.teacher_id
             )

             ORDER BY tr.name`,
            [dayName, periodNo, date]
        );

        res.json({
            date,
            period: periodNo,
            freeTeachers: result.rows
        });

    } catch (err) {
        console.error("Free teachers error:", err);

        res.status(500).json({
            error: "Failed to load free teachers."
        });
    }
});

// SEARCH ALL TEACHERS BY TEACHER ID
// Used when an admin manually changes a relief teacher.
router.get("/availability/search-teachers", async (req, res) => {
    try {
        const { date, period, q, allocationId } = req.query;

        // STEP 1: Validate the date
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({
                error: "A valid date is required (YYYY-MM-DD)."
            });
        }

        const [year, month, day] = date.split("-").map(Number);
        const selectedDate = new Date(year, month - 1, day, 12);

        if (
            selectedDate.getFullYear() !== year ||
            selectedDate.getMonth() !== month - 1 ||
            selectedDate.getDate() !== day
        ) {
            return res.status(400).json({
                error: "Invalid date."
            });
        }

        // STEP 2: Validate the period
        const periodNo = Number(period);

        if (!Number.isInteger(periodNo) || periodNo < 1) {
            return res.status(400).json({
                error: "A valid period number is required."
            });
        }

        // STEP 3: Validate the allocation ID
        const allocationIdNo = Number(allocationId);

        if (!Number.isInteger(allocationIdNo) || allocationIdNo < 1) {
            return res.status(400).json({
                error: "A valid allocation ID is required."
            });
        }

        // STEP 4: Validate the search text
        const searchText = typeof q === "string" ? q.trim() : "";

        if (!searchText) {
            return res.status(400).json({
                error: "Please enter a teacher ID."
            });
        }

        // STEP 5: Get the weekday name
        const dayName = selectedDate.toLocaleDateString(
            "en-US",
            { weekday: "long" }
        );

        // STEP 6: Check whether this relief assignment exists
        const allocationResult = await pool.query(
            `SELECT id
             FROM relief_allocations
             WHERE id = $1
             AND allocation_date = $2
             AND period_no = $3`,
            [allocationIdNo, date, periodNo]
        );

        if (allocationResult.rows.length === 0) {
            return res.status(404).json({
                error: "Relief assignment not found."
            });
        }

        // STEP 7: Search all teachers and calculate their availability
        const result = await pool.query(
            `SELECT
                tr.teacher_id,
                tr.name,

                CASE
                    -- Teacher has approved leave
                    WHEN EXISTS (
                        SELECT 1
                        FROM absences a
                       WHERE a.teacher_id = tr.teacher_id
AND LOWER(TRIM(a.status)) IN ('approved', 'registered')
                        AND a.startdate <= $1::date
                        AND a.enddate >= $1::date
                    )
                    THEN 'Absent'

                    -- Teacher is already covering another relief lesson
                    WHEN EXISTS (
                        SELECT 1
                        FROM relief_allocations r
                        WHERE r.allocation_date = $1
                        AND r.period_no = $2
                        AND r.assigned_teacher_id = tr.teacher_id
                        AND r.id <> $3
                    )
                    THEN 'Already assigned'

                    -- Teacher has a scheduled class
                    WHEN EXISTS (
                        SELECT 1
                        FROM timetable t
                        WHERE TRIM(t.teacher_id) = TRIM(tr.teacher_id)
                        AND t.period_no = $2
                        AND LOWER(TRIM(t.day_name)) = LOWER(TRIM($5))
                    )
                    THEN 'Not free'

                    -- Teacher has a free period
                    WHEN EXISTS (
                        SELECT 1
                        FROM freeperiods f
                        WHERE f.teacher_id = tr.teacher_id
                        AND f.period_no = $2
                        AND LOWER(TRIM(f.day_name)) = LOWER(TRIM($5))
                    )
                    THEN 'Available'

                    ELSE 'Not listed as free'
                END AS availability_status

             FROM teachers tr

             WHERE tr.teacher_id ILIKE $4

             ORDER BY tr.teacher_id

             LIMIT 10`,
            [
                date,
                periodNo,
                allocationIdNo,
                `${searchText}%`,
                dayName
            ]
        );

        // STEP 8: Return matching teachers
        res.json({
            date,
            period: periodNo,
            teachers: result.rows.map(teacher => ({
                ...teacher,
                canSelect: true
            }))
        });

    } catch (err) {
        console.error("Teacher search error:", err);

        res.status(500).json({
            error: "Failed to search teachers."
        });
    }
});

// MANUALLY UPDATE A RELIEF TEACHER
router.put("/availability/assign", requireLogin, async (req, res) => {
    try {
        const { allocationId, teacherId } = req.body;

        // STEP 1: Validate allocation ID
        const id = Number(allocationId);

        if (!Number.isInteger(id) || id < 1) {
            return res.status(400).json({
                error: "A valid relief allocation ID is required."
            });
        }

        // STEP 2: Validate teacher ID
        if (typeof teacherId !== "string" || !teacherId.trim()) {
            return res.status(400).json({
                error: "A valid teacher ID is required."
            });
        }

        const cleanTeacherId = teacherId.trim();

        // STEP 3: Check whether the teacher exists
        const teacherResult = await pool.query(
            `SELECT teacher_id, name
             FROM teachers
             WHERE TRIM(teacher_id) = TRIM($1)`,
            [cleanTeacherId]
        );

        if (teacherResult.rows.length === 0) {
            return res.status(404).json({
                error: "Teacher ID not found."
            });
        }

        // STEP 4: Update the relief assignment
        const result = await pool.query(
            `UPDATE relief_allocations
             SET assigned_teacher_id = $1,
                 is_manual = TRUE,
                 priority = 'Manual'
             WHERE id = $2
             RETURNING *`,
            [teacherResult.rows[0].teacher_id, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Relief assignment not found."
            });
        }

        // STEP 5: Return the updated assignment
        res.json({
            success: true,
            message: "Relief teacher assigned successfully.",
            assignment: {
                ...result.rows[0],
                assigned_teacher_name: teacherResult.rows[0].name
            }
        });

    } catch (err) {
        console.error("Manual assignment error:", err);

        res.status(500).json({
            error: "Failed to update relief assignment."
        });
    }
});

module.exports = router;
