
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
        leaveType,
        leaveDays
    } = req.body;

    const validLeaveTypes = ["medical", "duty", "casual"];

    // Validate leave type.
    if (!validLeaveTypes.includes(leaveType)) {
        return res.status(400).json({
            error: "Please select a valid leave type."
        });
    }

    // Validate date format.
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    if (
        !startDate ||
        !endDate ||
        !datePattern.test(startDate) ||
        !datePattern.test(endDate)
    ) {
        return res.status(400).json({
            error: "Please enter valid leave dates."
        });
    }

    // Validate that the dates are real calendar dates.
    const isValidDate = (value) => {
        const date = new Date(`${value}T00:00:00Z`);

        return !Number.isNaN(date.getTime()) &&
            date.toISOString().slice(0, 10) === value;
    };

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
        return res.status(400).json({
            error: "Please enter valid calendar dates."
        });
    }

    if (endDate < startDate) {
        return res.status(400).json({
            error: "Last day of leave cannot be before the starting date."
        });
    }

    // Medical leave is submitted one day at a time.
    const requestedDays = Number(leaveDays);

    if (
        !Number.isFinite(requestedDays) ||
        requestedDays <= 0 ||
        !Number.isInteger(requestedDays * 2)
    ) {
        return res.status(400).json({
            error: "Please enter a valid number of leave days."
        });
    }

    if (leaveType === "medical" && requestedDays !== 1) {
        return res.status(400).json({
            error: "Medical leave must be submitted one day at a time."
        });
    }

    if (leaveType === "medical" && startDate !== endDate) {
        return res.status(400).json({
            error: "Each medical leave application must cover one date."
        });
    }

    const employee = req.session.employee;
    const leaveYear = Number(startDate.slice(0, 4));

    let client;

    try {
        client = await pool.connect();

        await client.query("BEGIN");

        // Prevent simultaneous applications from exceeding the annual limit.
        await client.query(
            `SELECT pg_advisory_xact_lock($1::integer, $2::integer)`,
            [employee.id, leaveYear]
        );

        // Find the employee's timetable teacher record.
        const teacherResult = await client.query(
            `SELECT teacher_id, name
             FROM teachers
             WHERE LOWER(TRIM(teacher_id::text)) =
                   LOWER(TRIM($1))`,
            [employee.short_name]
        );

        if (teacherResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                error: "Your timetable teacher record could not be found. Please contact the administrator."
            });
        }

        const teacher = teacherResult.rows[0];

        // Prevent duplicate active medical applications for the same date.
        if (leaveType === "medical") {
            const duplicateResult = await client.query(
                `SELECT id
                 FROM absences
                 WHERE teacher_id = $1
                   AND leave_type = 'medical'
                   AND startdate = $2
                   AND LOWER(status) <> 'rejected'
                 LIMIT 1`,
                [teacher.teacher_id, startDate]
            );

            if (duplicateResult.rows.length > 0) {
                await client.query("ROLLBACK");

                return res.status(409).json({
                    error: "A medical leave application already exists for this date."
                });
            }
        }

        // Check annual leave limits.
        const limits = {
            medical: 20,
            casual: 21
        };

        if (leaveType === "medical" || leaveType === "casual") {

            const usageResult = await client.query(
                `SELECT
                    CASE
                        WHEN $2 = 'medical' THEN sick_leave_days
                        WHEN $2 = 'casual' THEN casual_leave_days
                    END AS used_days
                 FROM employee_annual_leave_usage
                 WHERE employee_id = $1
                   AND leave_year = $3`,
                [employee.id, leaveType, leaveYear]
            );

            const alreadyUsed = usageResult.rows.length > 0
                ? Number(usageResult.rows[0].used_days)
                : 0;

            // Include pending applications in the limit check.
            // They are NOT added to the official annual usage total.
            const pendingResult = await client.query(
                `SELECT COALESCE(SUM(leave_days), 0) AS pending_days
                 FROM absences
                 WHERE teacher_id = $1
                   AND LOWER(leave_type) = $2
                   AND LOWER(status) = 'pending'
                   AND EXTRACT(YEAR FROM startdate) = $3`,
                [teacher.teacher_id, leaveType, leaveYear]
            );

            const pendingDays = Number(
                pendingResult.rows[0].pending_days
            );

            const maximum = limits[leaveType];
            const remaining = maximum - alreadyUsed - pendingDays;

            if (requestedDays > remaining) {
                await client.query("ROLLBACK");

                return res.status(400).json({
                    error:
                        `${leaveType === "medical" ? "Medical" : "Casual"} leave limit is ${maximum} days per year. ` +
                        `Already used: ${alreadyUsed} days. ` +
                        `Pending applications: ${pendingDays} days. ` +
                        `Available: ${Math.max(0, remaining)} days.`
                });
            }
        }

        // Save the application as Pending.
        const result = await client.query(
            `INSERT INTO absences (
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
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE)
            RETURNING *`,
            [
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
        );

        await client.query("COMMIT");

        return res.status(201).json({
            message: "Leave application submitted successfully. Waiting for Principal approval.",
            absence: result.rows[0]
        });

    } catch (error) {

        if (client) {
            await client.query("ROLLBACK").catch(() => {});
        }

        console.error("Error saving leave:", error);

        return res.status(500).json({
            error: "Failed to save leave. Please try again."
        });

    } finally {

        if (client) {
            client.release();
        }

    }

});

module.exports = router;
