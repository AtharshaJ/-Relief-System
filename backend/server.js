
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);

const pool = require("./db");

const app = express();

// =====================================
// BASIC MIDDLEWARE
// =====================================

app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5000",
    credentials: true
}));

app.use(express.json());

// =====================================
// SESSION CONFIGURATION
// =====================================

if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is missing from the .env file.");
}

app.use(session({
    store: new PgSession({
        pool: pool,
        tableName: "user_sessions",
        createTableIfMissing: true
    }),

    secret: process.env.SESSION_SECRET,

    resave: false,
    saveUninitialized: false,

    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 8 * 60 * 60 * 1000
    }
}));

// =====================================
// AUTHENTICATION MIDDLEWARE
// =====================================

function requireEmployeeLogin(req, res, next) {

    if (!req.session || !req.session.employee) {
        return res.redirect("/login.html");
    }

    next();
}

// =====================================
// PROTECT LEAVE APPLICATION PAGE
// =====================================

app.get("/leave.html", requireEmployeeLogin, (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/leave.html"));
});

// =====================================
// SERVE FRONTEND FILES
// =====================================

app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/static/home.html"));
});

// =====================================
// IMPORT ROUTES
// =====================================

const absenceRoutes = require("./routes/absenceRoutes");
const leaveApprovalRoutes = require("./routes/leaveApproval");
const availabilityRoutes = require("./routes/availability");
const timetableRoutes = require("./routes/timetableRoutes");
const employeeRoutes = require("./routes/employeeRoutes");

// =====================================
// MOUNT ROUTES
// =====================================

app.use("/api/absences", absenceRoutes);
app.use("/api", leaveApprovalRoutes);
app.use("/api", availabilityRoutes);
app.use("/api", timetableRoutes);
app.use("/api/employees", employeeRoutes);

// =====================================
// START SERVER
// =====================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
