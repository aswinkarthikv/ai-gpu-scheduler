const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Scheduler = require('./scheduler');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // allow all in dev
        methods: ["GET", "POST"]
    }
});

const aiScheduler = new Scheduler(io);

app.post('/api/jobs', (req, res) => {
    const { type, payload, priority } = req.body;
    
    if (!type || !priority) {
        return res.status(400).json({ error: "Missing required fields: type, priority" });
    }

    const task = { type, payload };
    const jobId = aiScheduler.addJob(task, priority);
    
    res.json({ message: "Job submitted successfully", jobId, status: "queued", priority });
});

app.get('/api/jobs/:id', (req, res) => {
    const job = aiScheduler.jobs.get(req.params.id);
    if (!job) {
        return res.status(404).json({ error: "Job not found" });
    }
    res.json(job);
});

app.get('/api/system', (req, res) => {
    res.json(aiScheduler.getSystemState());
});

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Send immediate state on connection
    socket.emit('systemState', aiScheduler.getSystemState());

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Mini GPUaaS Backend running on port ${PORT}`);
});
