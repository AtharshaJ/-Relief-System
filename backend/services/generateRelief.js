const pool = require("../db");


//converts javascript date object into date sting format yyyy-mm-dd
function localDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

async function generateReliefForAbsence(absenceId) {

    console.log("generateReliefForAbsence called:", absenceId);

    const absenceResult = await pool.query(
        `SELECT *
         FROM absences
         WHERE id = $1`,
        [absenceId]
    );

    if (absenceResult.rows.length === 0) {
        throw new Error("Absence not found");
    }

    const absence = absenceResult.rows[0];

    console.log("Absence:", absence);

    // STEP 1 //Find existing relief assignments affected by this absence
    const affectedReliefs = await pool.query(
        `SELECT *
         FROM relief_allocations
         WHERE assigned_teacher_id = $1
         AND allocation_date BETWEEN $2 AND $3`,
        [
            absence.teacher_id,
            absence.startdate,
            absence.enddate
        ]
    );

    // STEP 2 deletes the releif assaignments identified above
    await pool.query(
        `DELETE FROM relief_allocations
         WHERE assigned_teacher_id = $1
         AND allocation_date BETWEEN $2 AND $3`,
        [
            absence.teacher_id,
            absence.startdate,
            absence.enddate
        ]
    );

    // STEP 3
    for (const relief of affectedReliefs.rows) {

        await allocateSingleLesson(
            relief.allocation_date,
            relief.day_name,
            relief.period_no,
            relief.class_name,
            relief.subject_name,
            relief.absent_teacher_id
        );
    }

    let current = new Date(absence.startdate);
    let end = new Date(absence.enddate);

    // convert UTC timestamp to local school date
    current.setHours(12, 0, 0, 0);
    end.setHours(12, 0, 0, 0);

    while (current <= end) {

        const dayOfWeek = current.getDay();

        // Skip weekends
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            current.setDate(current.getDate() + 1);
            continue;
        }

        const date = localDateString(current);

        const dayName = current.toLocaleDateString(
            "en-US",
            {
                weekday: "long"
            }
        );

        console.log(
            "Generating relief:",
            date,
            dayName,
            absence.teacher_id
        );

        await allocateReliefForDate(
            date,
            dayName,
            absence.teacher_id
        );

        current.setDate(current.getDate() + 1);
    }
}

async function allocateReliefForDate(
    date,
    dayName,
    absentTeacherId
) {

    const timetableResult = await pool.query(
        `SELECT t.*,
                tr.name AS teacher_name
         FROM timetable t
         JOIN teachers tr
           ON tr.teacher_id = t.teacher_id
         WHERE t.teacher_id = $1
         AND LOWER(TRIM(t.day_name)) = LOWER(TRIM($2))
         ORDER BY t.period_no`,
        [
            absentTeacherId,
            dayName
        ]
    );

    console.log(
        "Teacher:",
        absentTeacherId,
        "Day:",
        dayName,
        "Lessons:",
        timetableResult.rows.length
    );

    for (const lesson of timetableResult.rows) {

        console.log(
            "Lesson:",
            lesson.class_name,
            lesson.period_no
        );

        await allocateSingleLesson(
            date,
            dayName,
            lesson.period_no,
            lesson.class_name,
            lesson.subject_name,
            absentTeacherId
        );
    }
}

async function allocateSingleLesson(
    date,
    dayName,
    periodNo,
    className,
    subjectName,
    absentTeacherId
) {

    const existing = await pool.query(
        `SELECT id
         FROM relief_allocations
         WHERE allocation_date = $1
         AND absent_teacher_id = $2
         AND period_no = $3
         AND class_name = $4`,
        [
            date,
            absentTeacherId,
            periodNo,
            className
        ]
    );

    if (existing.rows.length > 0) {
        return;
    }

    const absentResult = await pool.query(
        `SELECT DISTINCT teacher_id
         FROM absences
         WHERE LOWER(TRIM(status)) IN ('approved', 'registered')
         AND startdate <= $1::date
         AND enddate >= $1::date`,
        [date]
    );

    const absentTeachers = new Set(
        absentResult.rows.map(
            row => String(row.teacher_id)
        )
    );

    const freeTeachersResult = await pool.query(
        `SELECT f.teacher_id,
                tr.name
         FROM freeperiods f
         JOIN teachers tr
           ON tr.teacher_id = f.teacher_id
         WHERE LOWER(TRIM(f.day_name)) = LOWER(TRIM($1))
         AND f.period_no = $2`,
        [
            dayName,
            periodNo
        ]
    );

    const alreadyUsed = await pool.query(
        `SELECT assigned_teacher_id
         FROM relief_allocations
         WHERE allocation_date = $1
         AND period_no = $2`,
        [
            date,
            periodNo
        ]
    );

    const usedIds = new Set(
        alreadyUsed.rows.map(
            row => String(row.assigned_teacher_id)
        )
    );

    let eligibleTeachers =
        freeTeachersResult.rows.filter(
            teacher =>
                !absentTeachers.has(
                    String(teacher.teacher_id)
                ) &&
                !usedIds.has(
                    String(teacher.teacher_id)
                )
        );

    let assignedTeacher = null;
    let priority = "No Teacher Available";

    if (eligibleTeachers.length > 0) {

        const sameClass = await pool.query(
            `SELECT tc.teacher_id,
                    tr.name
             FROM teacher_class tc
             JOIN teachers tr
               ON tr.teacher_id = tc.teacher_id
             WHERE tc.class_name = $1
             AND tc.teacher_id = ANY($2::text[])
             LIMIT 1`,
            [
                className,
                eligibleTeachers.map(
                    teacher => teacher.teacher_id
                )
            ]
        );

        if (sameClass.rows.length > 0) {

            assignedTeacher = sameClass.rows[0];
            priority = "Same Class";

        } else {

            assignedTeacher = eligibleTeachers[0];
            priority = "Any Available Teacher";
        }
    }

    console.log(
        "INSERTING:",
        date,
        className,
        periodNo,
        assignedTeacher
            ? assignedTeacher.teacher_id
            : "UNASSIGNED"
    );

    await pool.query(
        `INSERT INTO relief_allocations
        (
            allocation_date,
            day_name,
            period_no,
            class_name,
            subject_name,
            absent_teacher_id,
            assigned_teacher_id,
            priority
        )
        VALUES
        (
            $1,$2,$3,$4,$5,$6,$7,$8
        )`,
        [
            date,
            dayName,
            periodNo,
            className,
            subjectName,
            absentTeacherId,
            assignedTeacher
                ? assignedTeacher.teacher_id
                : "UNASSIGNED",
            priority
        ]
    );}

module.exports = {
    generateReliefForAbsence
};