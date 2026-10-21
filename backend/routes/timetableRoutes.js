const express = require('express');
const multer = require('multer');
const router = express.Router();
const { importTimetableXML } = require('../services/timetableService');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload-timetable', upload.single('timetable'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send("No XML file uploaded.");
    }

    try {
        const rowCount = await importTimetableXML(req.file.buffer);
        res.status(200).send(`Success! Replaced timetable with ${rowCount} rows.`);
    } catch (err) {
        console.error("Timetable import failed:", err);
        res.status(500).send("Server error during timetable import.");
    }
});

module.exports = router;