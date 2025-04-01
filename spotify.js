const axios = require('axios');
const qs = require('querystring');
require('dotenv').config();
const db = require('./db');
const { use } = require('./routes');

const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;


const getToken = async () => {
    const response = await axios.post('https://accounts.spotify.com/api/token',
        qs.stringify({ grant_type: 'client_credentials' }),
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
            }
        }
    );
    return response.data.access_token;
};

const extractPlaylistId = (url) => {
    const match = url.match(/(?:spotify:playlist:|https:\/\/open\.spotify\.com\/playlist\/)([a-zA-Z0-9]+)/i);
    return match ? match[1] : null;
};

const fetchPlaylistData = async (playlistUrl) => {
    const token = await getToken();
    console.log(token);

    const playlistId = extractPlaylistId(playlistUrl);
    
    if (!playlistId) throw new Error('Invalid playlist URL');

    
    if (await db.isPlaylistInDB(playlistId)) {
        console.log("Playlist already in DB");
        return;
    }
    else {
        console.log("Playlist not in DB, proceeding...");
    }
    

    const playlistResponse = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    let usersNames = await fetchPlaylistParticipants(playlistUrl);

    const tracks = [];
    let nextUrl = playlistResponse.data.tracks.href;
    
    let round = 0;
    while (nextUrl) {
        const trackResponse = await axios.get(nextUrl, {
            headers: { Authorization: `Bearer ${token}` }
        });
        trackResponse.data.items.forEach(track => {
            round++;
            adding_user_name = usersNames[track.added_by.id];
            db.addSong(playlistId, round, track.track.name, adding_user_name, (err) => {
                if (err) {
                    console.error("Błąd dodawania utworu:", err);
                }
            });
            tracks.push({
                name: track.track.name,
                artists: track.track.artists.map(artist => artist.name).join(', '),
                duration: track.track.duration_ms,
                addedBy: track.added_by ? track.added_by.id : 'Unknown'
            });
        });
        
        nextUrl = trackResponse.data.next;
    }


    //console.log("Uczestnicy playlisty:", Array.from(addedByUsers));
    // return {
    //     name: playlistResponse.data.name,
    //     owner: playlistResponse.data.owner.display_name,
    //     description: playlistResponse.data.description,
    //     tracks
    // };
};

const fetchUserNameById = async (userId) => {
    const token = await getToken();
    const userResponse = await axios.get(`https://api.spotify.com/v1/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return userResponse.data.display_name;
}

const fetchPlaylistParticipants = async (playlistUrl) => {
    const token = await getToken();
    const playlistId = extractPlaylistId(playlistUrl);
    if (!playlistId) throw new Error('Invalid playlist URL');

    const addedByUsers = new Set();
    let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks`;

    while (nextUrl) {
        const trackResponse = await axios.get(nextUrl, {
            headers: { Authorization: `Bearer ${token}` }
        });
        trackResponse.data.items.forEach(track => {
            if (track.added_by && track.added_by.id) {
                addedByUsers.add(track.added_by.id);
            }
        });

        nextUrl = trackResponse.data.next;
    }
    
    const usersNames = {};
    for (const userId of addedByUsers) {
        const userName = await fetchUserNameById(userId);
        usersNames[String(userId)] = userName;
    }
    return usersNames;
};




// Przykładowe użycie
const playlistUrl = 'https://open.spotify.com/playlist/2qLXVvQivgEtbFlBxeBnnL?si=06220c9396b24f88';
fetchPlaylistData(playlistUrl)
    .then(data => console.log("data"))
    .catch(error => console.error('Error:', error.message));

// fetchPlaylistParticipants(playlistUrl)
//     .then(participants => console.log('Uczestnicy playlisty:', participants))
//     .catch(error => console.error('Error:', error.message));

