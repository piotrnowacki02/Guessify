const express = require('express');
const routes = require("./routes");
const authenticateToken = require("./middleware");
const cors = require('cors');
const { Server } = require("socket.io");
require('dotenv').config(); 
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
        console.log(`🛋️ Użytkownik ${socket.id} dołączył do pokoju: ${room}`);
    });
});



// Uruchomienie serwera
app.listen(PORT,'0.0.0.0', () => {
    console.log(`Serwer działa na http://localhost:${PORT}`);
});
