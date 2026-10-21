const pool = require('../db');
const { XMLParser } = require('fast-xml-parser');

const dayMap = {
    "10000": "Monday",
    "01000": "Tuesday",
    "00100": "Wednesday",
    "00010": "Thursday",
    "00001": "Friday"
};

async function importTimetableXML(fileBuffer) {
    const xmlData = fileBuffer.toString('utf-8');
    
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: ""
    });
    
    const jsonObj = parser.parse(xmlData);
    const root = jsonObj.timetable;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Helper to ensure lookups are always handled as arrays
        const toArray = (item) => Array.isArray(item) ? item : (item ? [item] : []);

        // 1. Build Subjects Lookup (id -> name)
        const subjects = {};
        toArray(root.subjects?.subject).forEach(s => {
            subjects[s.id] = s.name;
        });

        // 2. Build Teachers Lookup (id -> name)
        const teachers = {};
        toArray(root.teachers?.teacher).forEach(t => {
            // aSc XML uses 'name' or fallback to 'lastname' if name is empty
            teachers[t.id] = t.name || t.lastname || "Unknown Teacher";
        });

        // 3. Build Classes Lookup (id -> name)
        const classes = {};
        toArray(root.classes?.class).forEach(c => {
            classes[c.id] = c.name;
        });

        // 4. Build Lessons Lookup (lesson_id -> { class_id, subject_id, teacher_id })
        const lessons = {};
        toArray(root.lessons?.lesson).forEach(l => {
            lessons[l.id] = {
                class_id: l.classids,
                subject_id: l.subjectid,
                teacher_id: l.teacherids
            };
        });

        // 5. Extract Timetable Rows from Cards
        const timetableRows = [];
        const cards = toArray(root.cards?.card);

        for (const card of cards) {
            const lessonId = card.lessonid;
            if (!lessons[lessonId]) continue;

            const lesson = lessons[lessonId];

            timetableRows.push({
                class_name: classes[lesson.class_id] || "Unknown Class",
                day_name: dayMap[card.days] || "Unknown Day",
                period_no: parseInt(card.period, 10),
                subject_name: subjects[lesson.subject_id] || "Unknown Subject",
                teacher_name: teachers[lesson.teacher_id] || "Unknown Teacher"
            });
        }

        // ===============================
        // Database Operations (Atomic)
        // ===============================
        
        // Clear existing timetable records
        await client.query('DELETE FROM timetable;');

        // Insert new records extracted from XML
        const insertQuery = `
            INSERT INTO timetable (class_name, day_name, period_no, subject_name, teacher_name)
            VALUES ($1, $2, $3, $4, $5)
        `;

        for (const row of timetableRows) {
            await client.query(insertQuery, [
                row.class_name,
                row.day_name,
                row.period_no,
                row.subject_name,
                row.teacher_name
            ]);
        }

        await client.query('COMMIT');
        return timetableRows.length;

    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { importTimetableXML };