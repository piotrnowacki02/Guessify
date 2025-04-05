const sqlite3 = require('sqlite3').verbose();

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

function getRoomUsersNames(roomId, callback) {
    db.all(`SELECT user_spotify_name FROM user_room_data WHERE id_room = ?`, [roomId], (err, rows) => {
        if (err) {
            return callback(err);
        }
        const names = rows.map(row => row.user_spotify_name);
        callback(null, names);
    });
}

function updateUserRoomName(user_room_name, id_user, user_spotify_name, id_room, callback) {
    db.run(`UPDATE user_room_data SET user_room_name = ?, id_user = ?  WHERE user_spotify_name = ? AND id_room = ?`, 
        [user_room_name, id_user, user_spotify_name, id_room],
        callback
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


module.exports = { 
    findUserByEmail,
    addUser,
    addRoom,
    updateRoomPlaylist,
    getAllData,
    addSong,
    isPlaylistInDB,
    getRoomUsersNames,
    updateUserRoomName
};
