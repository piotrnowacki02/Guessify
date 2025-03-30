const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
    if (req.path === "/register" || req.path === "/login") {
        return next();
    }
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) return res.status(401).json({ error: "Brak tokena" });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Nieprawidłowy token" });

        req.user = user;
        next();
    });
}

module.exports = authenticateToken;
