
function requireLogin(req, res, next) {

    if (req.session && req.session.authenticated === true) {
        return next();
    }

    return res.status(401).json({
        success: false,
        error: "Authentication required. Please log in."
    });
}

module.exports = {
    requireLogin
};
