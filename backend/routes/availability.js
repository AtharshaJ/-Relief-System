
const express = require("express");
const router = express.Router();
const pool = require("../db");

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
                 AND LOWER(a.status) = 'approved'
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

module.exports = router;
