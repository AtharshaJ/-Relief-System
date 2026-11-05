
const express = require("express");
const router = express.Router();
const pool = require("../db");

const { generateReliefForAbsence } =
    require("../services/generateRelief");

router.post("/", async (req, res) => {

    const { teacherId, startDate, endDate } = req.body;

    if (!teacherId || !startDate || !endDate) {
        return res.status(400).json({
            error: "Teacher ID, start date, and end date are required."
        });
    }

    const enteredTeacherId = String(teacherId).trim();

    try {

        // 1. Verify teacher exists
        const teacherResult = await pool.query(
            `SELECT teacher_id, name
             FROM teachers
             WHERE LOWER(TRIM(teacher_id::text)) = LOWER($1)`,
            [enteredTeacherId]
        );

        if (teacherResult.rows.length === 0) {
            return res.status(404).json({
                error: "Teacher ID not found. Please check your ID."
            });
        }

        const teacher = teacherResult.rows[0];

        // 2. Register leave
        const result = await pool.query(
            `INSERT INTO absences
             (teacher_id, name, startdate, enddate, reason, status)
             VALUES ($1, $2, $3, $4, NULL, $5)
             RETURNING *`,
            [
                teacher.teacher_id,
                teacher.name,
                startDate,
                endDate,
                "Registered"
            ]
        );

        const absence = result.rows[0];

        // 3. Automatically generate relief
        await generateReliefForAbsence(absence.id);

        return res.status(201).json({
            message: "Leave registered and relief generated successfully!",
            absence
        });

    } catch (err) {

        console.error("Error registering leave:", err);

        return res.status(500).json({
            error: "Leave registration or relief generation failed."
        });
    }
});

module.exports = router;
