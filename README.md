# 🏫 School Relief Management System

A web-based application designed to simplify teacher leave registration and automate relief allocation in schools.

The **School Relief Management System** helps school administrators manage teacher absences, identify available teachers and allocate relief periods efficiently using timetable information.

The system aims to reduce manual administrative work, improve the accuracy of relief allocation and make daily school operations more efficient.

---

## 🚀 Key Features

### 1. Teacher Leave Registration
- Register teacher absences using their teacher ID.
- Select leave start and end dates.
- Validate teacher information against the school database.
- Automatically save leave records.

### 2. Automatic Relief Allocation
- Generate relief allocations immediately after leave registration.
- Identify classes and periods affected by teacher absences.
- Find available teachers using their free-period information.
- Generate relief allocations based on timetable data.
- Avoid assigning teachers who are already occupied.

### 3. Teacher Availability Management
- View teacher availability for upcoming school days.
- Identify teachers who are free during specific periods.
- View existing relief assignments.
- Manually reassign relief teachers when necessary.

### 4. Timetable Management
- Store and manage school timetable information.
- Maintain teacher, class, subject and period details.
- Import timetable information for relief allocation.

### 5. Daily Relief Reports
- View daily relief allocations.
- Identify absent teachers and their assigned relief teachers.
- Access relief information for daily school administration.

### 6. Shared-Password Authentication
- Provide access to protected system operations through a shared school password.
- Allow staff to access the system from different devices.
- Keep public information accessible without login.
- Protect operations that modify system data using session-based authentication.

---

## ⚙️ System Workflow

The system follows an immediate leave-registration workflow.

1. A teacher accesses the School Relief System.
2. The teacher enters their teacher ID and leave dates.
3. The system validates the teacher's information.
4. The leave record is registered in the database.
5. The relief generation process starts automatically.
6. The system identifies affected classes and periods.
7. Available teachers are identified using timetable and free-period information.
8. Relief allocations are generated and made available for viewing.

**Note:** The current version does not require principal approval before registering leave or generating relief allocations.

---

## 🛠️ Technology Stack

| Component | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Node.js |
| Backend Framework | Express.js |
| Database | PostgreSQL |
| Database Hosting | Supabase |
| Application Hosting | Vercel |
| Authentication | Express Session |
| Session Storage | PostgreSQL |
| Version Control | Git and GitHub |

---

## 🗄️ Database Structure

The main database tables include:

| Table | Purpose |
|---|---|
| `teachers` | Stores teacher information. |
| `timetable` | Stores class timetable information. |
| `freeperiods` | Stores teachers' free periods. |
| `teacher_class` | Maintains teacher and class relationships. |
| `absences` | Stores teacher leave records. |
| `relief_allocations` | Stores automatic and manual relief allocations. |
| `user_sessions` | Stores authenticated user sessions. |

---

## 📁 Project Structure

```text
School-Relief-System/
│
├── backend/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   ├── db.js
│   └── server.js
│
├── public/
│   ├── static/
│   ├── css/
│   └── js/
│
├── frontend/
│
├── server.js
├── package.json
├── package-lock.json
├── vercel.json
├── code.sql
└── README.md
```

---

## 💻 Installation and Setup

### Prerequisites

Before running the application locally, ensure that you have:

- [Node.js](https://nodejs.org/)
- npm
- A PostgreSQL database
- Git

### 1. Clone the repository

```bash
git clone https://github.com/AtharshaJ/-Relief-System.git
```

### 2. Navigate to the project directory

```bash
cd -Relief-System
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create a `.env` file in the project root directory.

```env
DATABASE_URL=your_postgresql_connection_string
SESSION_SECRET=your_secure_session_secret
```

Also configure the shared school password using the environment variable expected by the authentication implementation.

**Important:** Never commit your `.env` file, database credentials, passwords or secret keys to GitHub.

### 5. Run the application

```bash
npm start
```

The application will run on the port configured in the backend.

---

## ☁️ Deployment

The application uses the following services:

- **Vercel:** Hosts the web application and backend.
- **Supabase:** Provides the hosted PostgreSQL database.
- **GitHub:** Stores the source code and supports version control.

The required environment variables must be configured in the Vercel project settings.

---

## 🔐 Security

- Protected operations require authentication.
- Session information is stored in PostgreSQL.
- HTTP-only session cookies are used.
- Secure cookies are enabled in production.
- Sensitive configuration values are maintained through environment variables.

---

## 📌 Current Version Scope

The current version focuses on simplifying teacher leave registration and relief allocation.

The following features are not included in this version:

- Individual employee registration and login.
- Principal account management.
- Principal leave approval and rejection.
- Annual leave balance tracking and calculations.

---

## 🎯 Project Objective

The main objective of the School Relief Management System is to provide a practical digital solution for managing teacher absences and relief allocation in schools.

By automating relief generation using timetable and teacher availability information, the system aims to reduce administrative workload and improve the efficiency of daily school operations.

---

## 👩‍💻 Developer

**Atharsha Jeyakanthan**

GitHub: [AtharshaJ](https://github.com/AtharshaJ)

---

*Developed to address a practical challenge in school administration through software engineering and automation.*
