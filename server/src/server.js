import express from 'express';
import http from 'http';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: Date.now() });
});

const server = http.createServer(app);

export { server, app };