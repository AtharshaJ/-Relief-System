
const express = require("express");
const router = express.Router();
const pool = require("../db");

// =====================================
// CHECK EMPLOYEE LOGIN
// =====================================

function requireEmployeeLogin(req, res, next) {

    if (!req.session || !req.session.employee) {
        return res.status(401).json({
            error: "Please log in before submitting a leave request."
        });
    }

    next();
}


// =====================================
// POST: SUBMIT LEAVE APPLICATION
// URL: /api/absences
// =====================================


router.post("/", requireEmployeeLogin, async (req, res) => {

    const {
        startDate,
        endDate,
        reason,
        leaveType
    } = req.body;


    // 1. Validate required fields.

    if (!startDate || !endDate) {
        return res.status(400).json({
            error: "Start date and end date are required."
        });
    }


    // 2. Validate leave type.

    const validLeaveTypes = [
        "medical",
        "duty",
        "casual"
    ];

    if (!validLeaveTypes.includes(leaveType)) {
        return res.status(400).json({
            error: "Please select a valid leave type."
        });
    }


    // 3. Validate dates.

    if (endDate < startDate) {
        return res.status(400).json({
            error: "End date cannot be earlier than start date."
        });
    }


    // 4. Get employee from authenticated session.

    const employee = req.session.employee;


    try {

        // 5. Find teacher using timetable short name.

        const teacherResult = await pool.query(
            `SELECT teacher_id, name
             FROM teachers
             WHERE LOWER(TRIM(teacher_id::text)) = LOWER(TRIM($1))`,
            [employee.short_name]
        );

        if (teacherResult.rows.length === 0) {
            return res.status(404).json({
                error: "Your timetable teacher record could not be found. Please contact the administrator."
            });
        }

        const teacher = teacherResult.rows[0];


        // 6. Insert leave request with its selected type.

      `INSERT INTO absences (
    employee_id,
    teacher_id,
    name,
    startdate,
    enddate,
    reason,
    status,
    leave_type,
    leave_days,
    leave_usage_updated
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE)
RETURNING *`,
[
    employee.id,
    teacher.teacher_id,
    teacher.name,
    startDate,
    endDate,
    typeof reason === "string"
        ? reason.trim() || null
        : null,
    "Pending",
    leaveType,
    requestedDays
]


        // 7. Return successful response.

        return res.status(201).json({
            message: "Leave submitted successfully!",
            absence: result.rows[0]
        });


    } catch (err) {

        console.error("Error saving leave:", err);

        return res.status(500).json({
            error: "Failed to save leave. Please try again."
        });

    }

});

module.exports = router;
