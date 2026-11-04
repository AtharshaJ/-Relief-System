
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

// Serve frontend files
app.use(express.static(path.join(__dirname, "../frontend")));

// Home page
app.get("/", (req, res) => {
    res.sendFile(
        path.join(__dirname, "../frontend/static/home.html")
    );
});

// Import routes
const absenceRoutes = require("./routes/absenceRoutes");
const leaveApprovalRoutes = require("./routes/leaveApproval");
const availabilityRoutes = require("./routes/availability");
const timetableRoutes = require("./routes/timetableRoutes");

// Mount routes
app.use("/api/absences", absenceRoutes);
app.use("/api", leaveApprovalRoutes);
app.use("/api", availabilityRoutes);
app.use("/api/timetable", timetableRoutes);

app.get("/api/timetable/test", (req, res) => {
    res.json({
        message: "Timetable router is loaded successfully"
    });
});

// Start server locally only
if (require.main === module) {
    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

// Export Express app for Vercel
module.exports = app;
