const sqlite3 = require('sqlite3').verbose();
//komentarz
const db = new sqlite3.Database('./users.db');

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

const addRoom = (id_owner, id_playlist, callback) => {
    db.run(`INSERT INTO rooms (id_owner, id_playlist) VALUES (?, ?)`, 
        [id_owner, id_playlist],
        callback
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



module.exports = { 
    findUserByEmail,
    addUser,
    addRoom,
    updateRoomPlaylist
};
