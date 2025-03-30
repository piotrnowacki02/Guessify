const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./db');
const authenticateToken = require("./middlewares/authenticateToken");

const router = express.Router();

// Obsługa rejestracji użytkownika
router.post('/register', async (req, res) => {
    console.log(req.body);
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email i hasło są wymagane!" });
    }

    // Sprawdzenie, czy e-mail już istnieje w bazie
    db.findUserByEmail(email, async (err, user) => {
        if (err) {
            return res.status(500).json({ error: "Błąd bazy danych." });
        }

        if (user) {
            return res.status(400).json({ error: "Użytkownik z takim e-mailem już istnieje." });
        }

        // Hashowanie hasła
        const hashedPassword = await bcrypt.hash(password, 10);

        // Dodanie użytkownika do bazy
        db.addUser(email, hashedPassword, (err) => {
            if (err) {
                return res.status(500).json({ error: "Nie udało się zarejestrować użytkownika." });
            }
            res.status(200).json({ message: "Użytkownik został zarejestrowany." });; // Przekierowanie na stronę logowania
            console.log("Użytkownik został zarejestrowany.");
        });
    });
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        console.log("logowanie bez emaila lub hasła");
        return res.status(400).json({ error: "Email i hasło są wymagane!" });
    }

    db.findUserByEmail(email, async (err, user) => {
        if (err) {
            console.log("błąd bazy danych");
            return res.status(500).json({ error: "Błąd bazy danych." });
        }

        if (!user) {
            console.log("użytkownik nie istnieje");
            return res.status(400).json({ error: "Użytkownik nie istnieje." });
        }

        // Porównanie hasła
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            console.log("nieprawidłowe hasło");
            return res.status(400).json({ error: "Nieprawidłowe hasło." });
        }

        const token = jwt.sign(
            { id: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log("zalogowano pomyślnie");
        res.status(200).json({ message: "Zalogowano pomyślnie.", token });
    });
});

router.post('/create-room',authenticateToken, async (req, res) => {

    const playlist = req.body.playlist;
    const user = req.user;
    
    db.addRoom(name, (err) => {
        if (err) {
            return res.status(500).json({ error: "Nie udało się utworzyć pokoju." });
        }
        res.status(200).json({ message: "Pokój został utworzony." });
    });
});


router.get('/', (req, res) => {
    res.send('Hello World!');
});

router.get('/marco', (req, res) => {
    res.send('Kochamy Marco!');
});

module.exports = router;
