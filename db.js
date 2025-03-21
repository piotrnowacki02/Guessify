const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./users.db');

// Tworzenie tabeli 'users' (jeśli nie istnieje)
db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
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

module.exports = { findUserByEmail, addUser };
