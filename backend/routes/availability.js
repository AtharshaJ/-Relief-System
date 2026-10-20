const express = require("express");
const router = express.Router();
const pool = require("../db"); // Fixed path to point to backend/db.js

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

        // 4. Fetch all registered teachers
        const teachersResult = await pool.query(
            `SELECT teacher_id, name FROM teachers ORDER BY name`
        );

        // 5. Fetch the timetable for the specific weekday
        const timetableResult = await pool.query(
            `SELECT id, class_name, day_name, period_no, subject_name, teacher_name
             FROM timetable
             WHERE LOWER(TRIM(day_name)) = LOWER($1)
             ORDER BY period_no, class_name`,
            [dayName]
        );

        // 6. Fetch teachers with approved leave covering this specific date
        const absencesResult = await pool.query(
            `SELECT DISTINCT teacher_id
             FROM absences
             WHERE LOWER(TRIM(status)) = 'approved'
               AND startdate <= $1::date
               AND enddate >= $1::date`,
            [date]
        );

        const teachers = teachersResult.rows;
        const lessons = timetableResult.rows;
        const absentTeacherIds = new Set(absencesResult.rows.map(row => String(row.teacher_id)));

        const normalizeName = name => String(name ?? "").trim().toLowerCase();

        // 7. Get unique period numbers scheduled for this day
        const periodNumbers = [
            ...new Set(lessons.map(lesson => Number(lesson.period_no)))
        ].sort((a, b) => a - b);

        // 8. Calculate free teachers and relief needed per period
        const periods = periodNumbers.map(periodNo => {
            const periodLessons = lessons.filter(lesson => Number(lesson.period_no) === periodNo);

            const scheduledTeacherNames = new Set(
                periodLessons.map(lesson => normalizeName(lesson.teacher_name))
            );

            // Free teachers: not absent and not currently teaching in this period
            const freeTeachers = teachers.filter(teacher => {
                const isAbsent = absentTeacherIds.has(String(teacher.teacher_id));
                const isTeaching = scheduledTeacherNames.has(normalizeName(teacher.name));
                return !isAbsent && !isTeaching;
            });

            // Relief needed: lessons whose regular teacher has an approved leave
            const reliefNeeded = periodLessons.filter(lesson => {
                const regularTeacher = teachers.find(
                    teacher => normalizeName(teacher.name) === normalizeName(lesson.teacher_name)
                );
                return regularTeacher && absentTeacherIds.has(String(regularTeacher.teacher_id));
            });

            return {
                periodNo,
                freeTeachers,
                reliefNeeded
            };
        });

        res.json({
            date,
            dayName,
            periods
        });

    } catch (error) {
        console.error("Availability error:", error);
        res.status(500).json({ error: "Unable to load teacher availability." });
    }
});

module.exports = router;