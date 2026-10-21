const express = require("express");
const cors = require("cors");
const path=require('path');
const app = express();

app.use(cors());
app.use(express.json());
// Serve static files from the 'frontend' folder
app.use(express.static(path.join(__dirname, '../frontend')));

// Explicitly route root URL to home.html (optional if express.static handles index.html by default)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/static/home.html'));
});

// Import routes
const absenceRoutes = require("./routes/absenceRoutes");
const leaveApprovalRoutes = require("./routes/leaveApproval");
const availabilityRoutes = require("./routes/availability");

// Mount routes
app.use("/api/absences", absenceRoutes);     // Handles POST /api/absences
app.use("/api", leaveApprovalRoutes);          // Handles GET /api/leave & PUT /api/leave/:id
app.use("/api", availabilityRoutes);           // Handles GET /api/availability

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});