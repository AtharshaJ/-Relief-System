
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);

const pool = require("./db");

const app = express();

// Trust Vercel's proxy so secure cookies work correctly.
app.set("trust proxy", 1);

// Check required session configuration
if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is missing from environment variables.");
}

// Middleware
app.use(cors());
app.use(express.json());

// Serve frontend files
app.use(express.static(
    path.join(__dirname, "../public"),
    { index: false }
));

// =====================================
// SESSION CONFIGURATION
// =====================================

app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: "school_auth_sessions",
        createTableIfMissing: false
    }),

    name: "school.sid",

    secret: process.env.SESSION_SECRET,

    resave: false,

    saveUninitialized: false,

    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 8 * 60 * 60 * 1000 // 8 hours
    }
}));

// =====================================
// HOME PAGE
// =====================================

app.get("/", (req, res) => {
    res.sendFile(
        path.join(__dirname, "../public/static/home.html")
    );
});

// =====================================
// IMPORT ROUTES
// =====================================

const authRoutes = require("./routes/authRoutes");
const absenceRoutes = require("./routes/absenceRoutes");
const availabilityRoutes = require("./routes/availability");
const timetableRoutes = require("./routes/timetableRoutes");
const dailyReportRoutes = require("./routes/dailyReport");

// =====================================
// MOUNT ROUTES
// =====================================

app.use("/api/auth", authRoutes);

app.use("/api/absences", absenceRoutes);

app.use("/api", availabilityRoutes);

app.use("/api/timetable", timetableRoutes);

app.use("/api", dailyReportRoutes);

// =====================================
// TEST ROUTE
// =====================================

app.get("/api/timetable/test", (req, res) => {
    res.json({
        message: "Timetable router is loaded successfully"
    });
});

// =====================================
// START SERVER LOCALLY
// =====================================

if (require.main === module) {
    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

// Export Express app for Vercel
module.exports = app;
