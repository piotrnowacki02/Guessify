const express = require('express');
const bcrypt = require('bcrypt');
const { findUserByEmail, addUser } = require('./db');

const router = express.Router();

// Obsługa rejestracji użytkownika
router.post('/register', async (req, res) => {
    console.log(req.body);
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email i hasło są wymagane!" });
    }

    // Sprawdzenie, czy e-mail już istnieje w bazie
    findUserByEmail(email, async (err, user) => {
        if (err) {
            return res.status(500).json({ error: "Błąd bazy danych." });
        }

        if (user) {
            return res.status(400).json({ error: "Użytkownik z takim e-mailem już istnieje." });
        }

        // Hashowanie hasła
        const hashedPassword = await bcrypt.hash(password, 10);

        // Dodanie użytkownika do bazy
        addUser(email, hashedPassword, (err) => {
            if (err) {
                return res.status(500).json({ error: "Nie udało się zarejestrować użytkownika." });
            }
            res.status(200); // Przekierowanie na stronę logowania
            console.log("Użytkownik został zarejestrowany.");
        });
    });
});

router.get('/', (req, res) => {
    res.send('Hello World!');
});

router.get('/marco', (req, res) => {
    res.send('Kochamy Marco!');
});

module.exports = router;
