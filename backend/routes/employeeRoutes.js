
const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../db");

const router = express.Router();


// =====================================
// POST: REGISTER A NEW EMPLOYEE
// URL: /api/employees/register
// =====================================


router.post("/register", async (req, res) => {

    let client;

    try {

        // 1. Receive employee details from the frontend.

        const {
            designation,
            fullName,
            trId,
            contactNumber,
            shortName,
            firstAppointmentDate,
            dutyLeaveDays,
            sickLeaveDays,
            casualLeaveDays,
            username,
            password
        } = req.body;


        // 2. Validate required fields.

        if (
            !designation ||
            !fullName ||
            !trId ||
            !contactNumber ||
            !shortName ||
            !firstAppointmentDate ||
            dutyLeaveDays === undefined ||
            sickLeaveDays === undefined ||
            casualLeaveDays === undefined ||
            !username ||
            !password
        ) {
            return res.status(400).json({
                error: "Please fill in all required fields."
            });
        }


        // 3. Clean employee details.

        const cleanDesignation = String(designation).trim();

        // Principal accounts must be authorised separately.
        if (cleanDesignation.toLowerCase() === "principal") {
            return res.status(403).json({
                error: "Principal accounts must be authorised by the system administrator."
            });
        }

        const cleanFullName = String(fullName).trim();
        const cleanTrId = String(trId).trim();
        const cleanContactNumber = String(contactNumber).trim();
        const cleanShortName = String(shortName).trim();
        const cleanUsername = String(username).trim();


        // 4. Validate field lengths.

        if (
            cleanFullName.length > 150 ||
            cleanTrId.length > 50 ||
            cleanShortName.length > 30 ||
            cleanDesignation.length > 100 ||
            cleanContactNumber.length > 20 ||
            cleanUsername.length > 50
        ) {
            return res.status(400).json({
                error: "One or more fields exceed the allowed length."
            });
        }


        // 5. Validate first appointment date.

        const appointmentDate = String(firstAppointmentDate).trim();

        const parsedAppointmentDate = new Date(
            appointmentDate + "T00:00:00Z"
        );

        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate) ||
            Number.isNaN(parsedAppointmentDate.getTime()) ||
            parsedAppointmentDate.toISOString().slice(0, 10) !== appointmentDate
        ) {
            return res.status(400).json({
                error: "Please enter a valid first appointment date."
            });
        }


        // 6. Validate initial 2026 leave usage.

        const leaveDays = [
            dutyLeaveDays,
            sickLeaveDays,
            casualLeaveDays
        ];

        if (
            leaveDays.some(days =>
                typeof days !== "number" ||
                !Number.isFinite(days) ||
                days < 0 ||
                !Number.isInteger(days * 2)
            )
        ) {
            return res.status(400).json({
                error: "Leave days must be valid non-negative numbers in increments of 0.5."
            });
        }


        // 7. Validate username.

        if (!/^[a-zA-Z0-9_.-]{4,50}$/.test(cleanUsername)) {
            return res.status(400).json({
                error: "Username must be 4-50 characters and contain only letters, numbers, dots, underscores or hyphens."
            });
        }


        // 8. Validate password.

        if (typeof password !== "string" || password.length < 8) {
            return res.status(400).json({
                error: "Password must contain at least 8 characters."
            });
        }

        if (password.length > 72) {
            return res.status(400).json({
                error: "Password is too long."
            });
        }


        // 9. Hash the password.

        const passwordHash = await bcrypt.hash(password, 12);


        // 10. Start a database transaction.

        client = await pool.connect();

        await client.query("BEGIN");


        // 11. Insert employee details.

        const result = await client.query(

            `INSERT INTO employees (
                tr_id,
                full_name,
                short_name,
                designation,
                contact_number,
                username,
                password_hash,
                first_appointment_date
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING
                id,
                tr_id,
                full_name,
                short_name,
                designation,
                contact_number,
                username,
                first_appointment_date,
                is_active,
                created_at`,

            [
                cleanTrId,
                cleanFullName,
                cleanShortName,
                cleanDesignation,
                cleanContactNumber,
                cleanUsername,
                passwordHash,
                appointmentDate
            ]

        );


        // 12. Get the newly created employee ID.

        const employeeId = result.rows[0].id;


        // 13. Save initial leave usage for 2026.

        await client.query(

            `INSERT INTO employee_annual_leave_usage (
                employee_id,
                leave_year,
                duty_leave_days,
                sick_leave_days,
                casual_leave_days
            )
            VALUES ($1, $2, $3, $4, $5)`,

            [
                employeeId,
                2026,
                dutyLeaveDays,
                sickLeaveDays,
                casualLeaveDays
            ]

        );


        // 14. Commit both database operations.

        await client.query("COMMIT");


        // 15. Registration successful.

        return res.status(201).json({

            message: "Employee registered successfully!",

            employee: result.rows[0]

        });


    } catch (error) {

        // Undo database changes if anything failed.

        if (client) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Registration rollback error:", rollbackError);
            }
        }

        console.error("Employee registration error:", error);


        // Handle duplicate values.

        if (error.code === "23505") {

            if (error.constraint === "employees_tr_id_unique") {
                return res.status(409).json({
                    error: "This official employee ID is already registered."
                });
            }

            if (error.constraint === "employees_short_name_unique") {
                return res.status(409).json({
                    error: "This timetable short name is already registered."
                });
            }

            if (error.constraint === "employees_username_unique") {
                return res.status(409).json({
                    error: "This username is already taken."
                });
            }

            return res.status(409).json({
                error: "An employee with these details may already exist."
            });

        }


        return res.status(500).json({
            error: "Registration failed. Please try again."
        });

    } finally {

        // Always release the database connection.

        if (client) {
            client.release();
        }

    }

});

// =====================================
// POST: EMPLOYEE LOGIN
// URL: /api/employees/login
// =====================================

router.post("/login", async (req, res) => {

    try {

        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                error: "Please enter your username and password."
            });
        }

        // Find the employee by username.
        const result = await pool.query(
            `SELECT
                id,
                tr_id,
                full_name,
                short_name,
                designation,
                username,
                password_hash,
                is_active
             FROM employees
             WHERE LOWER(TRIM(username)) = LOWER(TRIM($1))`,
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                error: "Invalid username or password."
            });
        }

        const employee = result.rows[0];

        // Check whether the account is active.
        if (!employee.is_active) {
            return res.status(403).json({
                error: "Your account is currently inactive."
            });
        }

        // Compare the entered password with the stored hash.
        const passwordMatches = await bcrypt.compare(
            password,
            employee.password_hash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                error: "Invalid username or password."
            });
        }

        // Create a new session after successful login.
        req.session.regenerate((error) => {

            if (error) {
                console.error("Session error:", error);

                return res.status(500).json({
                    error: "Unable to create login session."
                });
            }

            // Store only necessary employee details.
            req.session.employee = {
                id: employee.id,
                tr_id: employee.tr_id,
                full_name: employee.full_name,
                short_name: employee.short_name,
                designation: employee.designation,
                username: employee.username
            };

            req.session.save((saveError) => {

                if (saveError) {
                    console.error("Session save error:", saveError);

                    return res.status(500).json({
                        error: "Unable to save login session."
                    });
                }

                return res.json({
                    message: "Login successful!",
                    employee: req.session.employee
                });

            });

        });

    } catch (error) {

        console.error("Employee login error:", error);

        return res.status(500).json({
            error: "Login failed. Please try again."
        });

    }

});


// =====================================
// GET: CHECK LOGIN SESSION
// URL: /api/employees/me
// =====================================

router.get("/me", (req, res) => {

    if (!req.session || !req.session.employee) {
        return res.status(401).json({
            authenticated: false
        });
    }

    return res.json({
        authenticated: true,
        employee: req.session.employee
    });

});


// =====================================
// POST: EMPLOYEE LOGOUT
// URL: /api/employees/logout
// =====================================

router.post("/logout", (req, res) => {

    if (!req.session) {
        return res.json({
            message: "Logged out successfully."
        });
    }

    req.session.destroy((error) => {

        if (error) {
            console.error("Logout error:", error);

            return res.status(500).json({
                error: "Logout failed."
            });
        }

        res.clearCookie("connect.sid");

        return res.json({
            message: "Logged out successfully."
        });

    });

});

// =====================================
// POST: PRINCIPAL LOGIN
// URL: /api/employees/principal-login
// =====================================

router.post("/principal-login", async (req, res) => {

    try {

        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                error: "Please enter your username and password."
            });
        }

        // Find the account in the employee database.
        const result = await pool.query(
            `SELECT
                id,
                tr_id,
                full_name,
                designation,
                username,
                password_hash,
                is_active
             FROM employees
             WHERE LOWER(TRIM(username)) = LOWER(TRIM($1))`,
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                error: "Invalid username or password."
            });
        }

        const principal = result.rows[0];

        // Verify Principal designation.
        if (
            !principal.is_active ||
            principal.designation.trim().toLowerCase() !== "principal"
        ) {
            return res.status(403).json({
                error: "Access denied. Principal account only."
            });
        }

        // Verify password.
        const passwordMatches = await bcrypt.compare(
            password,
            principal.password_hash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                error: "Invalid username or password."
            });
        }

        // Create a fresh session.
        req.session.regenerate((error) => {

            if (error) {
                console.error("Principal session error:", error);

                return res.status(500).json({
                    error: "Unable to create Principal session."
                });
            }

            req.session.employee = {
                id: principal.id,
                tr_id: principal.tr_id,
                full_name: principal.full_name,
                designation: principal.designation,
                username: principal.username
            };

            req.session.principalAuthenticated = true;

            req.session.save((saveError) => {

                if (saveError) {
                    console.error("Principal session save error:", saveError);

                    return res.status(500).json({
                        error: "Unable to save Principal session."
                    });
                }

                return res.json({
                    message: "Principal login successful!",
                    employee: req.session.employee
                });

            });

        });

    } catch (error) {

        console.error("Principal login error:", error);

        return res.status(500).json({
            error: "Principal login failed. Please try again."
        });

    }

});

module.exports = router;
