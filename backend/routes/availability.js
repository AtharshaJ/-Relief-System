const express = require("express");
const router = express.Router();
const pool = require("../db");
router.get("/availability", async (req, res) => {
    try {
        const { date } = req.query;

        if (!date) {
            return res.status(400).json({
                error: "Date is required"
            });
        }

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

        console.log("Requested date:", date);
        console.log("Rows found:", result.rows.length);

        const groupedPeriods = {};

        result.rows.forEach(row => {
            if (!groupedPeriods[row.period_no]) {
                groupedPeriods[row.period_no] = {
                    periodNo: row.period_no,
                    reliefAssignments: [],
                    freeTeachers: []
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

        res.json({
            date,
            periods: Object.values(groupedPeriods)
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: "Failed to load relief allocations."
        });
    }
});

module.exports = router;