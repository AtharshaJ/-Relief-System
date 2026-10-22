const express = require('express');
const multer = require('multer');

const {
    importTimetableXML
} = require('../services/timetableServices');

const router = express.Router();

// Keep the uploaded XML in memory.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 20 * 1024 * 1024 // 20 MB
    },
    fileFilter: (req, file, callback) => {
        if (!file.originalname.toLowerCase().endsWith('.xml')) {
            return callback(
                new Error('Please upload an XML file.')
            );
        }

        callback(null, true);
    }
});

// POST /api/timetable/import
router.post('/import', (req, res, next) => {
    upload.single('timetable')(req, res, async error => {
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Please select an XML timetable file.'
            });
        }

        try {
            const result = await importTimetableXML(
                req.file.buffer
            );

            return res.status(200).json({
                success: true,
                message: 'Timetable imported successfully.',
                data: result
            });

        } catch (err) {
            console.error('Timetable import failed:', err);

            return res.status(500).json({
                success: false,
                message: 'Timetable import failed.',
                error: err.message
            });
        }
    });
});

module.exports = router;