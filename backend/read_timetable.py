import xml.etree.ElementTree as ET
import json
import psycopg2

# ===============================
# PostgreSQL Connection
# ===============================

conn = psycopg2.connect(
    host="localhost",
    database="releif_system",
    user="postgres",
    password="ENTC1716@j"
)



cursor = conn.cursor()

# ===============================
# Read XML
# ===============================

tree = ET.parse("timetable.xml")
root = tree.getroot()

# ===============================
# Subjects Lookup
# ===============================

subjects = {}

for subject in root.find("subjects"):
    subjects[subject.get("id")] = subject.get("name")

# ===============================
# Teachers Lookup
# ===============================

teachers = {}

for teacher in root.find("teachers"):
    teachers[teacher.get("id")] = teacher.get("name")

# ===============================
# Classes Lookup
# ===============================

classes = {}

for cls in root.find("classes"):
    classes[cls.get("id")] = cls.get("name")

# ===============================
# Lessons Lookup
# ===============================

lessons = {}

for lesson in root.find("lessons"):
    lessons[lesson.get("id")] = {
        "class_id": lesson.get("classids"),
        "subject_id": lesson.get("subjectid"),
        "teacher_id": lesson.get("teacherids")
    }

# ===============================
# Day Mapping
# ===============================

day_map = {
    "10000": "Monday",
    "01000": "Tuesday",
    "00100": "Wednesday",
    "00010": "Thursday",
    "00001": "Friday"
}

# ===============================
# Extract Timetable
# ===============================

timetable = []

for card in root.find("cards"):

    lesson_id = card.get("lessonid")

    if lesson_id not in lessons:
        continue

    lesson = lessons[lesson_id]

    row = {
        "class_name":
            classes.get(
                lesson["class_id"],
                "Unknown Class"
            ),

        "day_name":
            day_map.get(
                card.get("days"),
                "Unknown Day"
            ),

        "period_no":
            int(card.get("period")),

        "subject_name":
            subjects.get(
                lesson["subject_id"],
                "Unknown Subject"
            ),

        "teacher_name":
            teachers.get(
                lesson["teacher_id"],
                "Unknown Teacher"
            )
    }

    timetable.append(row)

# ===============================
# Save JSON File
# ===============================

with open(
    "timetable.json",
    "w",
    encoding="utf-8"
) as f:
    json.dump(
        timetable,
        f,
        indent=4,
        ensure_ascii=False
    )

print("JSON saved")

# ===============================
# Insert into PostgreSQL
# ===============================

for row in timetable:

    cursor.execute("""
        INSERT INTO timetable
        (
            class_name,
            day_name,
            period_no,
            subject_name,
            teacher_name
        )
        VALUES (%s,%s,%s,%s,%s)
    """,
    (
        row["class_name"],
        row["day_name"],
        row["period_no"],
        row["subject_name"],
        row["teacher_name"]
    ))

conn.commit()

print(f"{len(timetable)} rows inserted")

cursor.close()
conn.close()

print("Done")
