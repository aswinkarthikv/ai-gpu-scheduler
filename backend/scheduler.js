const { v4: uuidv4 } = require('uuid');

class Worker {
    constructor(id) {
        this.id = id;
        this.isBusy = false;
        this.currentJob = null;
        this.totalBusyTime = 0; // ms
    }
}

class Scheduler {
    constructor(io) {
        this.io = io;
        this.queue = [];
        this.workers = [
            new Worker('GPU-1'),
            new Worker('GPU-2'),
            new Worker('GPU-3'),
            new Worker('GPU-4')
        ];
        this.jobs = new Map();
        
        // Metrics
        this.startTime = Date.now();
        this.latencyMetrics = {
            totalProcessedTime: 0,
            completedJobs: 0
        };
    }

    addJob(task, priority) {
        const priorityLevels = {
            'real-time': 0,
            'high': 1,
            'low': 2
        };

        const job = {
            id: uuidv4(),
            task,
            priority: priorityLevels[priority] !== undefined ? priorityLevels[priority] : 2,
            priorityName: priority,
            status: 'queued',
            createdAt: Date.now(),
            startedAt: null,
            completedAt: null,
            logs: [],
            retries: 0,
            backoffUntil: null // for exponential backoff
        };

        this.jobs.set(job.id, job);
        this.queue.push(job);
        
        this.sortQueue();
        this.log(job.id, `Job created with priority: ${priority}`);
        this.broadcastState();
        this.processQueue();

        return job.id;
    }

    sortQueue() {
        this.queue.sort((a, b) => {
            if (a.priority === b.priority) {
                return a.createdAt - b.createdAt; // FIFO
            }
            return a.priority - b.priority; // Priority
        });
    }

    log(jobId, message) {
        const job = this.jobs.get(jobId);
        if (job) {
            job.logs.push(`[${new Date().toISOString()}] ${message}`);
            this.io.emit('jobLog', { id: jobId, message: job.logs[job.logs.length - 1] });
        }
    }

    processQueue() {
        // Filter jobs that are not waiting for backoff
        const readyJobs = this.queue.filter(job => !job.backoffUntil || job.backoffUntil < Date.now());
        
        const availableWorkers = this.workers.filter(w => !w.isBusy);
        
        if (availableWorkers.length === 0 || readyJobs.length === 0) {
            return;
        }

        while (availableWorkers.length > 0 && readyJobs.length > 0) {
            const worker = availableWorkers.shift();
            // Get highest priority ready job
            const jobIndex = this.queue.findIndex(j => j.id === readyJobs[0].id);
            if(jobIndex > -1) {
                const job = this.queue.splice(jobIndex, 1)[0];
                readyJobs.shift();
                this.assignJobToWorker(worker, job);
            }
        }
    }

    async assignJobToWorker(worker, job) {
        worker.isBusy = true;
        worker.currentJob = job;
        
        job.status = 'running';
        job.startedAt = Date.now();
        this.log(job.id, `Assigned to worker ${worker.id}`);
        this.broadcastState();

        // Simulate varying latencies
        let processingTime = 2000 + Math.random() * 5000;
        if (job.task.type === 'image_processing') processingTime += 3000;
        if (job.priorityName === 'real-time') processingTime *= 0.5;

        try {
            await this.simulateWork(processingTime, job);
            
            job.status = 'completed';
            job.completedAt = Date.now();
            worker.totalBusyTime += (job.completedAt - job.startedAt);
            
            this.log(job.id, `Job completed successfully in ${((job.completedAt - job.startedAt)/1000).toFixed(2)}s`);
            
            this.latencyMetrics.totalProcessedTime += (job.completedAt - job.createdAt);
            this.latencyMetrics.completedJobs++;

        } catch (error) {
            this.log(job.id, `Job failed: ${error.message}`);
            if (job.retries < 3) {
                job.retries++;
                job.status = 'queued';
                // Exponential Backoff: base * 2^retries 
                const backoffDelay = 1000 * Math.pow(2, job.retries);
                job.backoffUntil = Date.now() + backoffDelay;
                this.log(job.id, `Re-queuing with EXPONENTIAL BACKOFF (Retry ${job.retries}/3). Waiting ${backoffDelay}ms.`);
                this.queue.push(job);
                this.sortQueue();
                
                // Set a timer to reprocess queue after backoff expires
                setTimeout(() => this.processQueue(), backoffDelay);
            } else {
                job.status = 'failed';
                job.completedAt = Date.now();
                this.log(job.id, `Job failed permanently after max retries`);
            }
        }

        worker.isBusy = false;
        worker.currentJob = null;
        this.broadcastState();
        this.processQueue();
    }

    simulateWork(ms, job) {
        return new Promise((resolve, reject) => {
            const failChance = 0.20; // 20% failure to heavily demonstrate retry logic
            
            let progress = 0;
            const interval = setInterval(() => {
                progress += 20;
                if (progress <= 100) {
                   this.io.emit('jobProgress', { id: job.id, progress });
                }
            }, ms / 5);

            setTimeout(() => {
                clearInterval(interval);
                if (Math.random() < failChance) {
                    reject(new Error('Simulated random worker crash'));
                } else {
                    resolve();
                }
            }, ms);
        });
    }

    getAverageLatency() {
        if (this.latencyMetrics.completedJobs === 0) return 0;
        return (this.latencyMetrics.totalProcessedTime / this.latencyMetrics.completedJobs / 1000).toFixed(2);
    }

    getThroughput() {
        const uptimeSeconds = (Date.now() - this.startTime) / 1000;
        if (uptimeSeconds === 0) return 0;
        return (this.latencyMetrics.completedJobs / uptimeSeconds).toFixed(3);
    }
    
    getWorkerUtilization() {
        const uptimeMs = Date.now() - this.startTime;
        if (uptimeMs === 0) return 0;
        const totalBusy = this.workers.reduce((acc, w) => acc + w.totalBusyTime, 0);
        const maxBusy = this.workers.length * uptimeMs;
        // Approximation currently. Also account for current running jobs instantly if needed.
        return ((totalBusy / maxBusy) * 100).toFixed(1);
    }

    getSystemState() {
        return {
            workers: this.workers.map(w => ({
                id: w.id,
                isBusy: w.isBusy,
                currentJob: w.currentJob ? w.currentJob.id : null
            })),
            queue: this.queue.map(j => ({ id: j.id, priority: j.priorityName, status: j.status })),
            activeJobs: Array.from(this.jobs.values()).slice(-20).reverse(),
            avgLatencySec: this.getAverageLatency(),
            throughput: this.getThroughput(),
            utilization: this.getWorkerUtilization(),
            queueLength: this.queue.length
        };
    }

    broadcastState() {
        if (this.io) {
            this.io.emit('systemState', this.getSystemState());
        }
    }
}

module.exports = Scheduler;
