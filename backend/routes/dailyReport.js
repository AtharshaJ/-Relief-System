
const express = require("express");
const PDFDocument = require("pdfkit");
const pool = require("../db");

const router = express.Router();

// Generate daily relief report PDF
router.get("/daily-report", async (req, res) => {
    try {
        const { date } = req.query;

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({
                message: "Please provide a valid date (YYYY-MM-DD)."
            });
        }

        // Get relief assignments for the selected date
        const result = await pool.query(
            `
            SELECT
                ra.period_no,
                ra.class_name,
                ra.absent_teacher_id,
                absent_teacher.name AS absent_teacher_name,
                ra.assigned_teacher_id,
                assigned_teacher.name AS assigned_teacher_name
            FROM relief_allocations ra
            LEFT JOIN teachers absent_teacher
                ON absent_teacher.teacher_id = ra.absent_teacher_id
            LEFT JOIN teachers assigned_teacher
                ON assigned_teacher.teacher_id = ra.assigned_teacher_id
            WHERE ra.allocation_date = $1
            ORDER BY ra.period_no, ra.class_name
            `,
            [date]
        );

        const assignments = result.rows;

        const doc = new PDFDocument({
            size: "A4",
            layout: "landscape",
            margins: {
                top: 40,
                bottom: 40,
                left: 35,
                right: 35
            }
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="Daily-Relief-Report-${date}.pdf"`
        );

        doc.pipe(res);

        // Report heading
        doc.fontSize(18)
            .font("Helvetica-Bold")
            .text("SCHOOL RELIEF SYSTEM", {
                align: "center"
            });

        doc.moveDown(0.5);

        doc.fontSize(11)
            .font("Helvetica")
            .text("Daily Relief Report", {
                align: "center"
            });

        doc.moveDown();

        doc.fontSize(11)
            .text(`Date: ${date}`);

        doc.moveDown();

        // Table configuration
        const startX = 35;
        let y = doc.y;

        const columns = [
            { title: "Period", width: 65 },
            { title: "Class", width: 100 },
            { title: "Absent Teacher", width: 180 },
            { title: "Assigned Relief Teacher", width: 210 },
            { title: "Teacher's Signature", width: 200 }
        ];

        const rowHeight = 48;

        function drawRow(values, isHeader = false) {
            let x = startX;

            columns.forEach((column, index) => {
                doc.rect(x, y, column.width, isHeader ? 28 : rowHeight)
                    .stroke();

                doc.font(isHeader ? "Helvetica-Bold" : "Helvetica")
                    .fontSize(isHeader ? 9 : 9)
                    .text(
                        values[index] || "",
                        x + 5,
                        y + 8,
                        {
                            width: column.width - 10,
                            height: (isHeader ? 28 : rowHeight) - 10,
                            align: "left"
                        }
                    );

                x += column.width;
            });

            y += isHeader ? 28 : rowHeight;
        }

        drawRow(columns.map(column => column.title), true);

        // Assigned and unassigned lessons
        assignments.forEach(assignment => {
            if (y + rowHeight > doc.page.height - 40) {
                doc.addPage();
                y = 40;
            }

            drawRow([
                assignment.period_no,
                assignment.class_name,
                assignment.absent_teacher_name || assignment.absent_teacher_id,
                assignment.assigned_teacher_name || assignment.assigned_teacher_id || "UNASSIGNED",
                ""
            ]);
        });

        if (assignments.length === 0) {
            doc.fontSize(11)
                .text("No relief assignments found for this date.", startX, y + 10);
        }

        doc.end();

    } catch (error) {
        console.error("Daily report PDF error:", error);

        if (!res.headersSent) {
            res.status(500).json({
                message: "Failed to generate daily relief report."
            });
        }
    }
});

module.exports = router;
