const express = require('express');
const http = require("http");
const routes = require("./routes");
const authenticateToken = require("./middleware");
const cors = require('cors');
const { Server } = require("socket.io");
require('dotenv').config();
const db = require('./db');
const app = express();
const PORT = 3000;
const server = http.createServer(app); // Tworzymy serwer HTTP
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
// app.use(cors({
//     origin: 'http://localhost:8081', // Pozwól na żądania z aplikacji Expo
//     methods: 'GET,POST',             // Określone metody
//     allowedHeaders: 'Content-Type'   // Nagłówki, które są dozwolone
// }));

// Middleware do obsługi JSON
app.use(express.json());
app.use(authenticateToken);
app.use("/", routes);

io.on("connection", (socket) => {
    console.log(`Nowe połączenie: ${socket.id}`);

    socket.on("joinRoom", (room) => {
        socket.join(room);
    
        db.getRoomUsersNames(room, (err, users) => {
            if (err) {
                console.error("Błąd pobierania użytkowników z pokoju:", err);
                return;
            }
    
            io.to(room).emit("roomUsers", users);
        });
    
        console.log(`🛋️(${socket.id}) dołączył do pokoju: ${room}`);
    });

    socket.on("admin-game-start", (room) => {
        db.startGame(room, (err) => {
            if (err) {
                console.error("Błąd podczas uruchamiania gry:", err);
                return;
            }
        });
        io.to(room).emit("game_start");
        console.log(`🛋️(${socket.id}) rozpoczął grę w pokoju: ${room}`);
    });
});



// Uruchomienie serwera
server.listen(PORT,'0.0.0.0', () => {
    console.log(`Serwer działa na http://localhost:${PORT}`);
});
