const express = require("express");
const router = express.Router();
const pool = require("../db");

router.post("/", async (req, res) => {
    const { teacherId, startDate, endDate, reason } = req.body;
    
    if (!teacherId || !startDate || !endDate) {
        return res.status(400).json({ error: "Teacher ID, start date, and end date are required." });
    }

    const enteredTeacherId = String(teacherId).trim();

    try {
        // 1. Verify the teacher exists using teacher_id
        const teacherResult = await pool.query(
            `SELECT teacher_id, name FROM teachers WHERE LOWER(TRIM(teacher_id::text)) = LOWER($1)`,
            [enteredTeacherId]
        );

        if (teacherResult.rows.length === 0) {
            return res.status(404).json({ error: "Teacher ID not found. Please check your ID." });
        }

        const teacher = teacherResult.rows[0];

        // 2. Insert leave request
        const result = await pool.query(
            `INSERT INTO absences (teacher_id, name, startdate, enddate, reason, status) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING *`,
            [
                teacher.teacher_id, 
                teacher.name, 
                startDate, 
                endDate,
                typeof reason === "string" ? reason.trim() || null : null, 
                "Pending"
            ]
        );

        return res.status(201).json({
            message: "Leave submitted successfully!",
            absence: result.rows[0]
        });

    } catch (err) {
        console.error("Error saving leave:", err);
        return res.status(500).json({ error: "Failed to save leave. Please try again." });
    }
});

module.exports = router;