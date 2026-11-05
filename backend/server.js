
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
// PRINCIPAL AUTHENTICATION MIDDLEWARE
// =====================================

async function requirePrincipalLogin(req, res, next) {
    try {
        if (
            !req.session ||
            !req.session.employee ||
            !req.session.principalAuthenticated
        ) {
            return res.redirect("/principal-login.html");
        }

        // Verify the account directly from the database.
        const result = await pool.query(
            `SELECT designation, is_active
             FROM employees
             WHERE id = $1`,
            [req.session.employee.id]
        );

        if (result.rows.length === 0) {
            return res.redirect("/principal-login.html");
        }

        const principal = result.rows[0];

        if (
            !principal.is_active ||
            principal.designation.trim().toLowerCase() !== "principal"
        ) {
            return res.status(403).send(
                "Access denied. Principal access only."
            );
        }

        next();

    } catch (error) {
        console.error("Principal authentication error:", error);

        return res.status(500).send(
            "Unable to verify Principal access."
        );
    }
}

// =====================================
// PROTECT LEAVE APPLICATION PAGE
// =====================================

app.get("/leave.html", requireEmployeeLogin, (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/leave.html"));
});

// =====================================
// PROTECT PRINCIPAL DASHBOARD
// =====================================

app.get(
    "/principal-notifications.html",
    requirePrincipalLogin,
    (req, res) => {
        res.sendFile(
            path.join(__dirname, "../frontend/principal-notifications.html")
        );
    }
);

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
