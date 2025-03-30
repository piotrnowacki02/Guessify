const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) return res.status(401).json({ error: "Brak tokena" });

    jwt.verify(token, "sekretny-klucz", (err, user) => {
        if (err) return res.status(403).json({ error: "Nieprawidłowy token" });

        req.user = user;
        next();
    });
}

module.exports = authenticateToken;
