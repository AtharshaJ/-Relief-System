
const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../db");

const router = express.Router();


// =====================================
// POST: REGISTER A NEW EMPLOYEE
// URL: /api/employees/register
// =====================================

router.post("/register", async (req, res) => {

    try {

        // 1. Receive employee details from the frontend.

        const {
            designation,
            fullName,
            trId,
            contactNumber,
            shortName,
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
            !username ||
            !password
        ) {
            return res.status(400).json({
                error: "Please fill in all required fields."
            });
        }


        // 3. Remove unnecessary spaces.

        const cleanDesignation = String(designation).trim();
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


        // 5. Validate username.

        if (!/^[a-zA-Z0-9_.-]{4,50}$/.test(cleanUsername)) {

            return res.status(400).json({
                error: "Username must be 4-50 characters and contain only letters, numbers, dots, underscores or hyphens."
            });

        }


        // 6. Validate password.

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


        // 7. Hash the password.

        const passwordHash = await bcrypt.hash(password, 12);


        // 8. Insert the employee into PostgreSQL.

        const result = await pool.query(

            `INSERT INTO employees (
                tr_id,
                full_name,
                short_name,
                designation,
                contact_number,
                username,
                password_hash
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING
                id,
                tr_id,
                full_name,
                short_name,
                designation,
                contact_number,
                username,
                is_active,
                created_at`,

            [
                cleanTrId,
                cleanFullName,
                cleanShortName,
                cleanDesignation,
                cleanContactNumber,
                cleanUsername,
                passwordHash
            ]

        );


        // 9. Registration successful.

        return res.status(201).json({

            message: "Employee registered successfully!",

            employee: result.rows[0]

        });


    } catch (error) {

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

module.exports = router;
