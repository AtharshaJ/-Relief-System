
# School Relief System

A web-based application designed to help schools manage teacher information, record teacher absences, and organize relief-teacher allocations efficiently.

## About the Project

Managing teacher absences and arranging suitable relief teachers can be time-consuming when handled manually. The School Relief System aims to simplify this process by providing a centralized platform for managing teacher records, maintaining timetable information, recording absences, and suggesting suitable relief teachers.

The system is designed for use by a school administrator or ICT teacher, who can review and approve suggested relief allocations.

## Objectives

- Maintain a centralized database of school teachers.
- Manage teacher timetable information.
- Record teacher absences and leave.
- Identify available teachers for relief assignments.
- Suggest suitable relief teachers based on timetable availability and subject assignments.
- Allow the administrator to review and approve relief allocations.
- Reduce timetable conflicts and manual administrative work.

## Technology Stack

| Technology | Purpose |
|---|---|
| HTML5 | Structure of the web pages |
| CSS3 | Styling and responsive layouts |
| JavaScript | Frontend functionality and API requests |
| Node.js | Backend runtime environment |
| Express.js | Backend API and request handling |
| PostgreSQL | Relational database |
| pg | PostgreSQL connectivity for Node.js |
| dotenv | Environment configuration |
| Nodemon | Automatic backend restarts during development |

## Current Features

### Teacher Management

- Add new teacher records.
- View registered teachers.
- Edit existing teacher details.
- Delete teacher records.
- Search teachers by employee ID, name, or contact number.
- Prevent duplicate employee IDs.

Teacher records include:
- Employee ID
- Full name
- Contact number

## Planned Features

- **Timetable Management:** Maintain teacher assignments, subjects, classes, days, and periods.
- **Absence and Leave Management:** Record teacher absences for relevant dates and periods.
- **Relief Teacher Suggestions:** Identify suitable teachers based on their scheduled lessons, availability, and subject assignments.
- **Relief Schedule Management:** Allow the administrator to review, modify, approve, and manage suggested allocations.
- **Timetable System Integration:** Investigate integration with the school's existing ASC timetable system.
- **Conflict Prevention:** Prevent a teacher from being assigned to multiple classes during the same period.

## Project Structure

```text
school-relief-system/
├── public/
│   ├── teachers.html
│   ├── style.css
│   └── teachers.js
├── backend/
│   ├── routes/
│   │   └── teachers.js
│   ├── db.js
│   ├── server.js
│   ├── package.json
│   └── .env
├── .gitignore
└── README.md
```

## Prerequisites

Make sure the following are installed:

- [Node.js](https://nodejs.org/)
- [PostgreSQL](https://www.postgresql.org/)
- [Visual Studio Code](https://code.visualstudio.com/) (recommended)

## Installation and Setup

### 1. Clone the Repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd school-relief-system
```

Replace the placeholder with your actual GitHub repository URL.

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

If the project does not yet include the required dependencies, install them with:

```bash
npm install express pg dotenv
npm install --save-dev nodemon
```

### 3. Create the PostgreSQL Database

Create a PostgreSQL database named:

```text
school_relief_db
```

Run the following SQL in the database's query tool:

```sql
CREATE TABLE teachers (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    contact_number VARCHAR(30) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 4. Configure Environment Variables

Create a `.env` file inside the `backend` directory:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=school_relief_db
DB_USER=postgres
DB_PASSWORD=YOUR_POSTGRES_PASSWORD
```

Replace `YOUR_POSTGRES_PASSWORD` with your PostgreSQL user's password.

**Security:** Never commit your `.env` file or database credentials to GitHub.

### 5. Start the Backend Server

From the `backend` directory, run:

```bash
npm run dev
```

The server should start at:

```text
http://localhost:5000
```

### 6. Open the Application

Once the backend is running, open:

- **Teacher Management:** http://localhost:5000/teachers.html
- **Database Health Check:** http://localhost:5000/api/health
- **Teacher API:** http://localhost:5000/api/teachers

The health-check endpoint can be used to verify that the backend can communicate with PostgreSQL.

## API Endpoints

The backend provides the following teacher-management endpoints:

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/teachers` | Retrieve all teachers |
| POST | `/api/teachers` | Add a teacher |
| PUT | `/api/teachers/:id` | Update a teacher |
| DELETE | `/api/teachers/:id` | Delete a teacher |
| GET | `/api/health` | Check server and database connectivity |

### Example: Add a Teacher

Send a `POST` request to `/api/teachers` with a JSON body:

```json
{
  "employee_id": "T001",
  "full_name": "Example Teacher",
  "contact_number": "0771234567"
}
```

## Development Notes

- The initial version focuses on teacher management.
- Timetable management, absence recording, and relief allocation are planned for subsequent development stages.
- The backend API and frontend must be connected for teacher operations to persist in PostgreSQL.
- Timetable data will be managed independently initially, while future ASC integration options are investigated.
- Teacher deletion will need to account for related timetable and relief records as those features are implemented.

## Future Improvements

- Authentication and role-based access control.
- Importing timetable data from supported school systems.
- Automated relief-teacher recommendations.
- Relief workload balancing.
- Improved reporting and schedule exports.
- Deployment for secure access within the school.

## Contributing

This project is under active development. Suggestions, bug reports, and contributions are welcome.

## License

No license has been specified yet. Add an appropriate open-source license before allowing others to reuse or redistribute the project.
