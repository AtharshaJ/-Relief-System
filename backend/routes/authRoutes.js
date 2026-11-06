
const express = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");

const router = express.Router();

// Limit repeated login attempts
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        success: false,
        error: "Too many login attempts. Please try again later."
    }
});

// POST: Login using the shared school password
router.post("/login", loginLimiter, async (req, res) => {
    try {
        const { password } = req.body;

        if (typeof password !== "string" || !password) {
            return res.status(400).json({
                success: false,
                error: "Please enter the school password."
            });
        }

        const passwordHash = process.env.SCHOOL_PASSWORD_HASH;

        if (!passwordHash) {
            console.error("SCHOOL_PASSWORD_HASH is not configured.");

            return res.status(500).json({
                success: false,
                error: "Authentication is not configured."
            });
        }

        const isValid = await bcrypt.compare(
            password,
            passwordHash
        );

        if (!isValid) {
            return res.status(401).json({
                success: false,
                error: "Incorrect school password."
            });
        }

        // Regenerate session after successful login
        req.session.regenerate((err) => {
            if (err) {
                console.error("Session regeneration error:", err);

                return res.status(500).json({
                    success: false,
                    error: "Login failed. Please try again."
                });
            }

            req.session.authenticated = true;

            req.session.save((saveError) => {
                if (saveError) {
                    console.error("Session save error:", saveError);

                    return res.status(500).json({
                        success: false,
                        error: "Could not create login session."
                    });
                }

                return res.json({
                    success: true,
                    message: "Login successful."
                });
            });
        });

    } catch (err) {
        console.error("Login error:", err);

        res.status(500).json({
            success: false,
            error: "An unexpected login error occurred."
        });
    }
});

// GET: Check whether the user is logged in
router.get("/session", (req, res) => {
    res.json({
        authenticated: req.session?.authenticated === true
    });
});

// POST: Logout
router.post("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Logout error:", err);

            return res.status(500).json({
                success: false,
                error: "Logout failed."
            });
        }

        res.clearCookie("school.sid");

        return res.json({
            success: true,
            message: "Logged out successfully."
        });
    });
});

module.exports = router;
