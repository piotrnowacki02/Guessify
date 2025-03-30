const express = require('express');
const routes = require("./routes");
const cors = require('cors');
require('dotenv').config(); 
const app = express();
const PORT = 3000;


app.use(cors());
// app.use(cors({
//     origin: 'http://localhost:8081', // Pozwól na żądania z aplikacji Expo
//     methods: 'GET,POST',             // Określone metody
//     allowedHeaders: 'Content-Type'   // Nagłówki, które są dozwolone
// }));

// Middleware do obsługi JSON
app.use(express.json());
app.use("/", routes);



// Uruchomienie serwera
app.listen(PORT,'0.0.0.0', () => {
    console.log(`Serwer działa na http://localhost:${PORT}`);
});
