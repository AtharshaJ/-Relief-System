const pool = require('../db');
const { XMLParser } = require('fast-xml-parser');

const dayMap = {
    '0': 'Monday',
    '1': 'Tuesday',
    '2': 'Wednesday',
    '3': 'Thursday',
    '4': 'Friday'
};

const TOTAL_PERIODS = 8;

function toArray(item) {
    if (item === undefined || item === null) {
        return [];
    }
    return Array.isArray(item) ? item : [item];
}

function toIds(value) {
    if (value === undefined || value === null || value === '') {
        return [];
    }
    return String(value)
        .split(',')
        .map(id => id.trim())
        .filter(Boolean);
}

async function importTimetableXML(fileBuffer) {
    const xmlData = fileBuffer.toString('utf-8');

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: ''
    });

    const jsonObj = parser.parse(xmlData);
    const root = jsonObj.timetable;

    if (!root) {
        throw new Error('Invalid XML: timetable root not found.');
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // ==========================================
        // 1. SUBJECT LOOKUP
        // ==========================================
        const subjects = {};
        toArray(root.subjects?.subject).forEach(subject => {
            subjects[String(subject.id)] = subject.name;
        });

        // ==========================================
        // 2. CLASS LOOKUP
        // ==========================================
        const classes = {};
        toArray(root.classes?.class).forEach(classItem => {
            classes[String(classItem.id)] = classItem.name;
        });

        // ==========================================
        // 3. READ XML TEACHERS
        // ==========================================
        const xmlTeachers = {};
        toArray(root.teachers?.teacher).forEach(teacher => {
            const xmlId = String(teacher.id ?? '');
            const shortName = String(teacher.short ?? '').trim();
            const name = String(teacher.name || teacher.lastname || '').trim();

            if (!xmlId || !shortName || !name) {
                throw new Error(`Teacher is missing an ID, short name, or name: ${xmlId}`);
            }

            xmlTeachers[xmlId] = {
                name,
                short: shortName
            };
        });

        // ==========================================
        // 4. REGISTER TEACHERS IN POSTGRESQL
        // ==========================================
        const teacherIdMap = {}; // Maps XML ID -> Teacher's Short Name (VARCHAR)

        for (const [xmlId, teacher] of Object.entries(xmlTeachers)) {
            const existing = await client.query(
                `SELECT teacher_id
                 FROM teachers
                 WHERE LOWER(TRIM(teacher_id)) = LOWER(TRIM($1))
                 LIMIT 1`,
                [teacher.short]
            );

            if (existing.rows.length > 0) {
                await client.query(
                    `UPDATE teachers
                     SET name = $1
                     WHERE teacher_id = $2`,
                    [teacher.name, teacher.short]
                );
            } else {
                await client.query(
                    `INSERT INTO teachers (name, teacher_id)
                     VALUES ($1, $2)`,
                    [teacher.name, teacher.short]
                );
            }

            teacherIdMap[xmlId] = teacher.short;
        }

        // ==========================================
        // 5. LESSON LOOKUP
        // ==========================================
        const lessons = {};
        toArray(root.lessons?.lesson).forEach(lesson => {
            lessons[String(lesson.id)] = {
                classIds: toIds(lesson.classids),
                subjectId: String(lesson.subjectid ?? ''),
                teacherIds: toIds(lesson.teacherids)
            };
        });

        // ==========================================
        // 6. PREPARE DATA COLLECTIONS
        // ==========================================
        const timetableRows = [];
        const teacherClassMap = new Map();
        const scheduledPeriods = new Set();

        const cards = toArray(root.cards?.card);

        // ==========================================
        // 7. PROCESS TIMETABLE CARDS
        // ==========================================
        for (const card of cards) {
            const lesson = lessons[String(card.lessonid ?? '')];
            if (!lesson) {
                continue;
            }

            // FIXED: use card.day instead of card.days
            const dayName = dayMap[String(card.day)];
            const periodNo = Number.parseInt(card.period, 10);

            if (
                !dayName ||
                !Number.isInteger(periodNo) ||
                periodNo < 1 ||
                periodNo > TOTAL_PERIODS
            ) {
                continue;
            }

            const classIds = lesson.classIds;
            const xmlTeacherIds = lesson.teacherIds;

            for (const xmlTeacherId of xmlTeacherIds) {
                let teacherShort = teacherIdMap[xmlTeacherId];
                if (!teacherShort && !xmlTeacherId.startsWith('*')) {
                    teacherShort = teacherIdMap['*' + xmlTeacherId];
                } else if (!teacherShort && xmlTeacherId.startsWith('*')) {
                    teacherShort = teacherIdMap[xmlTeacherId.substring(1)];
                }

                if (!teacherShort) {
                    continue; 
                }

                // Mark teacher as occupied using their short name
                scheduledPeriods.add(`${teacherShort}|${dayName}|${periodNo}`);

                for (const classId of classIds) {
                    const className = classes[String(classId)];
                    if (!className) {
                        continue;
                    }

                    const key = `${teacherShort}|${className}`;
                    teacherClassMap.set(key, {
                        class_name: className,
                        teacher_id: teacherShort
                    });

                    timetableRows.push({
                        class_name: className,
                        day_name: dayName,
                        period_no: periodNo,
                        subject_name: subjects[lesson.subjectId] || 'Unknown Subject',
                        teacher_id: teacherShort
                    });
                }
            }
        }

        const teacherClassRows = [...teacherClassMap.values()];

        // ==========================================
        // 8. CALCULATE FREE PERIODS
        // ==========================================
        const freePeriodRows = [];
        const uniqueTeacherShorts = [...new Set(Object.values(teacherIdMap))];

        for (const teacherShort of uniqueTeacherShorts) {
            for (const dayName of Object.values(dayMap)) {
                for (let periodNo = 1; periodNo <= TOTAL_PERIODS; periodNo++) {
                    const key = `${teacherShort}|${dayName}|${periodNo}`;
                    if (!scheduledPeriods.has(key)) {
                        freePeriodRows.push({
                            teacher_id: teacherShort,
                            day_name: dayName,
                            period_no: periodNo
                        });
                    }
                }
            }
        }

        // ==========================================
        // 9. REPLACE OLD TIMETABLE DATA
        // ==========================================
        await client.query('DELETE FROM freeperiods');
        await client.query('DELETE FROM teacher_class');
        await client.query('DELETE FROM timetable');

        // ==========================================
        // 10. INSERT TIMETABLE
        // ==========================================
        const timetableQuery = `
            INSERT INTO timetable
                (class_name, day_name, period_no, subject_name, teacher_id)
            VALUES ($1, $2, $3, $4, $5)
        `;

        for (const row of timetableRows) {
            await client.query(timetableQuery, [
                row.class_name,
                row.day_name,
                row.period_no,
                row.subject_name,
                row.teacher_id
            ]);
        }

        // ==========================================
        // 11. INSERT TEACHER-CLASS DATA
        // ==========================================
        const teacherClassQuery = `
            INSERT INTO teacher_class (class_name, teacher_id)
            VALUES ($1, $2)
        `;

        for (const row of teacherClassRows) {
            await client.query(teacherClassQuery, [
                row.class_name,
                row.teacher_id
            ]);
        }

        // ==========================================
        // 12. INSERT FREE PERIODS
        // ==========================================
        const freePeriodQuery = `
            INSERT INTO freeperiods
                (teacher_id, day_name, period_no)
            VALUES ($1, $2, $3)
        `;

        for (const row of freePeriodRows) {
            await client.query(freePeriodQuery, [
                row.teacher_id,
                row.day_name,
                row.period_no
            ]);
        }

        // ==========================================
        // 13. SAVE ALL CHANGES
        // ==========================================
        await client.query('COMMIT');

        return {
            teachersImported: Object.keys(xmlTeachers).length,
            timetableRecords: timetableRows.length,
            teacherClassRecords: teacherClassRows.length,
            freePeriodRecords: freePeriodRows.length
        };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

module.exports = { importTimetableXML };