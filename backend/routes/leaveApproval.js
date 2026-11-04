const express = require("express");
const router = express.Router();
const pool = require("../db");

const { generateReliefForAbsence } =
    require("../services/generateRelief");

router.get("/leave", async (req, res) => {
    try {
        const status = req.query.status || "Pending";

        const result = await pool.query(
            `SELECT 
                a.id,
                a.teacher_id,
                a.reason,
                a.startdate,
                a.enddate,
                a.status,
                t.name AS teacher_name
             FROM absences a
             JOIN teachers t
               ON a.teacher_id = t.teacher_id
             WHERE LOWER(a.status) = LOWER($1)
             ORDER BY a.startdate DESC`,
            [status]
        );

        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching leave applications:", err);
        res.status(500).json({ error: "Failed to load leave applications." });
    }
});

router.put("/leave/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!["Approved", "Rejected", "Pending"].includes(status)) {
            return res.status(400).json({ error: "Invalid status value." });
        }

        const result = await pool.query(
            `UPDATE absences SET status = $1 WHERE id = $2 RETURNING *`,
            [status, id]
        );

       if (result.rows.length === 0) {
    return res.status(404).json({ error: "Leave application not found." });
}

const absence = result.rows[0];

if (status === "Approved") {
    await generateReliefForAbsence(absence.id);
}

        res.json({
            message: `Leave application ${status.toLowerCase()} successfully.`,
            absence: result.rows[0]
        });
    } catch (err) {
        console.error("Error updating leave application:", err);
        res.status(500).json({ error: "Failed to update leave application." });
    }
});

module.exports = router;