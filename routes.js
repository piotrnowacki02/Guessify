const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./db');
const spotify = require('./spotify');
const path = require('path');

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

router.post("/create-room", (req, res) => {
    const id_owner = req.user.id;
    let id_playlist = req.body.playlist;

    if (!id_playlist) {
        return res.status(400).json({ error: "Brak id_playlist" });
    }

    spotify.fetchPlaylistData(id_playlist);
    id_playlist = spotify.extractPlaylistId(id_playlist);
    if (!id_playlist) {
        return res.status(400).json({ error: "Nie udało się pobrać danych z playlisty." });
    }
    console.log(id_playlist);
    db.addRoom(id_owner, id_playlist, (err, roomId) => {
        if (err) {
            console.error("Błąd dodawania pokoju:", err);
            return res.status(500).json({ error: "Nie udało się utworzyć pokoju." });
        }
        res.status(201).json({ message: "Pokój został utworzony.", roomId });
    });
});

router.post("/join-room", (req, res) => {
    const id_user = req.user.id;
    const { roomId } = req.body;

    if (!roomId) {
        return res.status(400).json({ error: "Brak id_pokoju" });
    }

    db.getRoom(roomId, (err, room) => {
        if (err) {
            console.error("Błąd podczas sprawdzania pokoju:", err.message);
            return res.status(404).json({ error: "Pokój nie istnieje" });
        }
        db.getRoomStatus(roomId, (err, status) => {
            if (err) {
                console.error("Błąd podczas sprawdzania statusu pokoju:", err.message);
                return res.status(500).json({ error: "Nie udało się sprawdzić statusu pokoju." });
            }
            if (status === "playing") {
                return res.status(400).json({ error: "Pokój jest już w trakcie gry." });
            }

            res.status(200).json({ message: "Dołączono do pokoju", room });
        });


    });
});

router.post("/get-room-players", (req, res) => {
    const id_room = req.body.id_room;
    if (!id_room) {
        return res.status(400).json({ error: "Brak id_pokoju" });
    }

    db.getRoomUsersSpotifyNames(id_room, (err, players) => {
        if (err) {
            console.error("Błąd pobierania graczy z pokoju:", err);
            return res.status(500).json({ error: "Nie udało się pobrać graczy z pokoju." });
        }
        res.status(200).json(players);
    });
});

router.post("/set-user-room-name", (req, res) => {
    const id_user = req.user.id;
    const { id_room, user_room_name, user_spotify_name } = req.body;

    if (!user_room_name || !id_user || !user_spotify_name || !id_room) {
        console.log("Brak wymaganych danych.");
        return res.status(400).json({ error: "Brak wymaganych danych." });
    }

    db.updateUserRoomName(user_room_name, id_user, user_spotify_name, id_room, (err) => {
        if (err) {
            console.error("Błąd aktualizacji nazwy użytkownika w pokoju:", err);
            return res.status(500).json({ error: "Nie udało się zaktualizować nazwy użytkownika w pokoju." });
        }
        console.log("Zaktualizowano nazwę użytkownika w pokoju.");
        res.status(200).json({ message: "Nazwa użytkownika została zaktualizowana." });
    });
});

router.get('/', (req, res) => {
    res.send('Hello World!');
});

router.get('/marco', (req, res) => {
    // // res.send('Kochamy Marco!');
    // db.getAllData((err, data) => {
    //     if (err) {
    //         console.error("Błąd pobierania danych z bazy:", err);
    //         return res.status(500).json({ error: "Nie udało się pobrać danych z bazy." });
    //     }
    //     res.status(200).json(data);
    // });

    res.sendFile(path.join(__dirname, 'music.mp3'));
});

module.exports = router;
