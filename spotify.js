const axios = require('axios');
const qs = require('querystring');
require('dotenv').config();

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
    const playlistId = extractPlaylistId(playlistUrl);
    if (!playlistId) throw new Error('Invalid playlist URL');

    const playlistResponse = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    const tracks = [];
    let nextUrl = playlistResponse.data.tracks.href;
    
    while (nextUrl) {
        const trackResponse = await axios.get(nextUrl, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        trackResponse.data.items.forEach(track => {
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
    return {
        name: playlistResponse.data.name,
        owner: playlistResponse.data.owner.display_name,
        description: playlistResponse.data.description,
        tracks
    };
};

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

    return Array.from(addedByUsers);
};




// Przykładowe użycie
const playlistUrl = 'https://open.spotify.com/playlist/2qLXVvQivgEtbFlBxeBnnL?si=06220c9396b24f88';
fetchPlaylistData(playlistUrl)
    .then(data => console.log(data))
    .catch(error => console.error('Error:', error.message));

fetchPlaylistParticipants(playlistUrl)
    .then(participants => console.log('Uczestnicy playlisty:', participants))
    .catch(error => console.error('Error:', error.message));

