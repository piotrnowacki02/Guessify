const sqlite3 = require('sqlite3').verbose();

const { get } = require('http');
const { promisify } = require('util');

const db = new sqlite3.Database('./users.db');

// Konwersja metod na wersję Promise
db.allAsync = promisify(db.all).bind(db);

// Tworzenie tabeli 'users' (jeśli nie istnieje)
db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
    )
`);

// Tworzenie tabeli 'rooms' (jeśli nie istnieje)
db.run(`
    CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_owner INTEGER NOT NULL,
        round INTEGER DEFAULT 0,
        id_playlist INTEGER,
        status TEXT DEFAULT 'setting up',
        FOREIGN KEY (id_owner) REFERENCES users(id)
    )
`);

// Tworzenie tabeli 'songs' (jeśli nie istnieje)
db.run(`
    CREATE TABLE IF NOT EXISTS songs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_playlist INTEGER NOT NULL,
        round INTEGER NOT NULL,
        song TEXT NOT NULL,
        added_by TEXT NOT NULL,
        FOREIGN KEY (id_playlist) REFERENCES rooms(id)
    )
`);

db.run(`
    CREATE TABLE IF NOT EXISTS user_room_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_room INTEGER NOT NULL,
        id_user INTEGER NULL,
        user_spotify_name TEXT NOT NULL,
        user_room_name TEXT NULL,
        points INTEGER DEFAULT 0,
        FOREIGN KEY (id_room) REFERENCES rooms(id),
        FOREIGN KEY (id_user) REFERENCES users(id),
        FOREIGN KEY (user_spotify_name) REFERENCES songs(added_by)
    )
`);

db.run(`
    CREATE TABLE IF NOT EXISTS guesses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_room INTEGER NOT NULL,
        id_guesser INTEGER DEFAULT NULL,
        answer TEXT DEFAULT NULL,
        round INTEGER NOT NULL,
        FOREIGN KEY (id_room) REFERENCES rooms(id),
        FOREIGN KEY (id_guesser) REFERENCES users(id),
        FOREIGN KEY (id_room, round) REFERENCES songs(id_playlist, round),
        FOREIGN KEY (answer) REFERENCES songs(added_by)
    )
`);

// Funkcja sprawdzająca, czy użytkownik istnieje
const findUserByEmail = (email, callback) => {
    db.get(`SELECT * FROM users WHERE email = ?`, [email], callback);
};

// Funkcja dodająca nowego użytkownika
const addUser = (email, hashedPassword, callback) => {
    db.run(`INSERT INTO users (email, password) VALUES (?, ?)`, 
        [email, hashedPassword],
        callback
    );
};

const getRoom = (id_room, callback) => {
    db.get(`SELECT * FROM rooms WHERE id = ?`, [id_room], (err, row) => {
        if (err) {
            return callback(err);
        }
        if (!row) {
            return callback(new Error("Room not found"));
        }
        callback(null, row);
    });
};

const getRoomStatus = (id_room, callback) => {
    db.get(`SELECT status FROM rooms WHERE id = ?`, [id_room], (err, row) => {
        if (err) {
            return callback(err);
        }
        if (!row) {
            return callback(new Error("Room not found"));
        }
        callback(null, row.status);
    });
}

const addRoom = (id_owner, id_playlist, callback) => {
    db.run(
        `INSERT INTO rooms (id_owner, id_playlist) VALUES (?, ?)`, 
        [id_owner, id_playlist],
        function (err) {
            if (err) {
                return callback(err);
            }
            const roomId = this.lastID;

            // Query the 'songs' table for distinct 'added_by' values
            db.all(
                `SELECT DISTINCT added_by FROM songs WHERE id_playlist = ?`, 
                [id_playlist],
                (err, rows) => {
                    if (err) {
                        return callback(err);
                    }

                    // Insert data into user_room_data for each distinct 'added_by'
                    const stmt = db.prepare(
                        `INSERT INTO user_room_data (id_room, user_spotify_name) VALUES (?, ?)`
                    );
                    for (const row of rows) {
                        stmt.run([roomId, row.added_by]);
                    }
                    stmt.finalize((err) => {
                        if (err) {
                            return callback(err);
                        }
                        // Return the id of the newly created room and the distinct 'added_by' values
                        callback(null, roomId);
                    });
                }
            );
        }
    );
};

const updateRoomPlaylist = (id_playlist, id_room, songs, callback) => {
    db.run(`UPDATE rooms SET id_playlist = ? WHERE id = ?`, 
        [id_playlist, id_room],
        function (err) {
            if (err) {
                return callback(err);
            }

            // Insert songs into the 'songs' table
            const stmt = db.prepare(`INSERT INTO songs (id_playlist, round, song, added_by) VALUES (?, ?, ?, ?)`);
            let round = 1;
            for (const song of songs) {
                stmt.run([id_playlist, round, song.song, song.added_by]);
                round++;
            }
            stmt.finalize(callback);
        }
    );
};

const addSong = (id_playlist, round, song, added_by, callback) => {
    db.run(`INSERT INTO songs (id_playlist, round, song, added_by) VALUES (?, ?, ?, ?)`, 
        [id_playlist, round, song, added_by],
        callback
    );
}

async function isPlaylistInDB(playlistId) {
    try {
        const rows = await db.allAsync(`SELECT * FROM songs WHERE id_playlist = ?`, [playlistId]);
        return rows.length > 0;
    } catch (error) {
        console.error("Database error:", error);
        return false;
    }
}

function getRoomUsersSpotifyNames(roomId, callback) {
    db.all(`SELECT user_spotify_name FROM user_room_data WHERE id_room = ?`, [roomId], (err, rows) => {
        if (err) {
            return callback(err);
        }
        const names = rows.map(row => row.user_spotify_name);
        callback(null, names);
    });
}

function getRoomUsersNames(roomId, callback) {
    db.all(
        `
        SELECT 
            urd.id_user, 
            urd.user_room_name, 
            CASE 
                WHEN urd.id_user = r.id_owner THEN 1 
                ELSE 0 
            END AS is_admin
        FROM user_room_data urd
        JOIN rooms r ON urd.id_room = r.id
        WHERE urd.id_room = ? AND urd.user_room_name IS NOT NULL
        `,
        [roomId],
        (err, rows) => {
            if (err) {
                return callback(err);
            }
            const names = rows.map(row => ({
                id_user: row.id_user,
                user_room_name: row.user_room_name,
                is_admin: row.is_admin === 1 
            }));
            callback(null, names);
        }
    );
}


function updateUserRoomName(user_room_name, id_user, user_spotify_name, id_room, callback) {
    // First, reset id_user and user_room_name to null for existing records with the same id_user in the room
    db.run(
        `UPDATE user_room_data SET id_user = NULL, user_room_name = NULL WHERE id_user = ? AND id_room = ?`, 
        [id_user, id_room],
        function (err) {
            if (err) {
                return callback(err);
            }
            // Check if any record with the given id_room and user_spotify_name has id_user assigned (not null)
            db.get(
                `SELECT 1 FROM user_room_data WHERE id_room = ? AND user_spotify_name = ? AND id_user IS NOT NULL`, 
                [id_room, user_spotify_name],
                (err, row) => {
                    if (err) {
                        return callback(err);
                    }
                    if (row) {
                        return callback(new Error("This user is already assigned to another account."));
                    }
                    // Proceed with the update if no id_user is assigned
                    db.run(
                        `UPDATE user_room_data SET user_room_name = ?, id_user = ? WHERE user_spotify_name = ? AND id_room = ?`, 
                        [user_room_name, id_user, user_spotify_name, id_room],
                        callback
                    );
                }
            );
        }
    );
}

// Funkcja inicjalizująca rekordy w guesses dla wszystkich graczy i wszystkich rund w danym pokoju
function initializeGuessesForRoom(id_room, callback) {
    // Pobierz wszystkich użytkowników z user_room_data dla danego pokoju
    db.all(`SELECT id_user FROM user_room_data WHERE id_room = ? AND id_user IS NOT NULL`, [id_room], (err, users) => {
        if (err) return callback(err);
        if (!users || users.length === 0) return callback(null); // Brak graczy

        // Pobierz id_playlist dla pokoju
        db.get(`SELECT id_playlist FROM rooms WHERE id = ?`, [id_room], (err, room) => {
            if (err) return callback(err);
            if (!room) return callback(new Error("Room not found"));
            const id_playlist = room.id_playlist;

            // Pobierz liczbę rund (piosenek) dla tej playlisty
            db.all(`SELECT round FROM songs WHERE id_playlist = ?`, [id_playlist], (err, rounds) => {
                if (err) return callback(err);
                if (!rounds || rounds.length === 0) return callback(null); // Brak rund

                // Przygotuj statement do inserta
                const stmt = db.prepare(`INSERT INTO guesses (id_room, id_guesser, answer, round) VALUES (?, ?, '', ?)`);
                for (const user of users) {
                    for (const roundObj of rounds) {
                        stmt.run([id_room, user.id_user, roundObj.round]);
                    }
                }
                stmt.finalize(callback);
            });
        });
    });
}

function startGame(id_room, callback) {
    db.get(
        `SELECT status FROM rooms WHERE id = ?`,
        [id_room],
        (err, row) => {
            if (err) {
                return callback(err);
            }
            if (row && row.status === 'playing') {
                return callback(null);
            }

            // Jeśli status nie jest 'playing', zaktualizuj go i zainicjuj guesses
            db.run(
                `UPDATE rooms SET status = 'playing', round = 1 WHERE id = ?`, 
                [id_room],
                function (err) {
                    if (err) {
                        return callback(err);
                    }
                    initializeGuessesForRoom(id_room, (err) => {
                        if (err) {
                            return callback(err);
                        }
                        callback(null);
                    });
                }
            );
        }
    );
}

const getAllData = (callback) => {
    db.all(`
        SELECT 
            users.id AS user_id, 
            users.email, 
            rooms.id AS room_id, 
            rooms.id_owner, 
            rooms.round, 
            rooms.id_playlist, 
            rooms.status
        FROM users
        LEFT JOIN rooms ON users.id = rooms.id_owner
    `, [], callback);
};

const getRoundInfo = (id_room, callback) => {
    db.get(
        `SELECT id_owner, round FROM rooms WHERE id = ?`,
        [id_room],
        (err, roomRow) => {
            if (err) return callback(err);
            if (!roomRow) return callback(new Error("Room not found"));

            db.all(
                `SELECT coalesce(user_room_name, user_spotify_name) as user_room_name, points FROM user_room_data WHERE id_room = ?`,
                [id_room],
                (err, userRows) => {
                    if (err) return callback(err);

                    const users = {};
                    userRows.forEach(row => {
                        users[row.user_room_name] = row.points;
                    });

                    callback(null, {
                        id_owner: roomRow.id_owner,
                        round: roomRow.round,
                        users
                    });
                }
            );
        }
    );
};

// Aktualizuje odpowiedź gracza w tabeli guesses dla danej rundy
function setUserGuess(roomId, userId, selectedUser, callback) {
    // Użyj bezpośrednio db.get, bo db.getRoom nie jest dostępne w tym kontekście
    db.get(`SELECT * FROM rooms WHERE id = ?`, [roomId], (err, room) => {
        if (err || !room) {
            return callback(err || new Error("Pokój nie istnieje"));
        }
        const round = room.round;
        db.run(
            `UPDATE guesses SET answer = ? WHERE id_room = ? AND id_guesser = ? AND round = ?`,
            [selectedUser, roomId, userId, round],
            callback
        );
    });
}

function checkAnswers(roomId, callback) {
    db.get(`SELECT id_playlist, round FROM rooms WHERE id = ?`, [roomId], (err, room) => {
        if (err || !room) {
            return callback(err || new Error("Room not found"));
        }
        const id_playlist = room.id_playlist;
        const round = room.round;

        db.all(
            `SELECT g.id_guesser, g.answer, urd.user_spotify_name,
                    (SELECT s.added_by FROM songs s WHERE s.id_playlist = ? AND s.round = ?) AS correct_spotify_name
             FROM guesses g 
             JOIN user_room_data urd ON g.answer = coalesce(urd.user_room_name, urd.user_spotify_name) AND urd.id_room = g.id_room
             WHERE g.id_room = ? AND g.round = ?`,
            [id_playlist, round, roomId, round],
            (err, guesses) => {
                if (err) return callback(err);

                const stmt = db.prepare(`UPDATE user_room_data SET points = points + 1 WHERE id_user = ? AND id_room = ?`);
                guesses.forEach(guess => {
                    // guess.user_spotify_name to osoba, na którą strzelał gracz
                    // correct_spotify_name to faktyczny właściciel piosenki w tej rundzie
                    if (guess.user_spotify_name && guess.user_spotify_name === guess.correct_spotify_name) {
                        stmt.run([guess.id_guesser, roomId]);
                    }
                });
                stmt.finalize((err) => {
                    if (err) return callback(err);
                    callback(null, guesses);
                });
            }
        );
    });
}

// Funkcja do przejścia do następnej rundy w pokoju
function nextRound(roomId, callback) {
    db.run(
        `UPDATE rooms SET round = round + 1 WHERE id = ?`,
        [roomId],
        callback
    );
}

module.exports = { 
    findUserByEmail,
    addUser,
    addRoom,
    updateRoomPlaylist,
    getAllData,
    addSong,
    isPlaylistInDB,
    getRoomUsersNames,
    getRoomUsersSpotifyNames,
    updateUserRoomName,
    getRoom,
    startGame,
    getRoomStatus,
    getRoundInfo,
    setUserGuess,
    checkAnswers,
    nextRound,
};
