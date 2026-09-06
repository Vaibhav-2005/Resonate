import 'dotenv/config'; // <-- Add this right at the top!
import { server } from './server.js';
import { initializeSockets } from './sockets/socketManager.js';

// Now it securely uses your .env variable
const PORT = process.env.PORT || 8080;

initializeSockets(server);

server.listen(PORT, () => {
    console.log(`🚀 Resonate Backend running on port ${PORT}`);
}); 