-- PostgreSQL Database Schema Mock

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) NOT NULL,
    tier VARCHAR(20) DEFAULT 'basic', -- basic, pro, enterprise (affects rate limiting)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    task_type VARCHAR(50) NOT NULL,
    priority INT NOT NULL DEFAULT 2, -- 0: Real-Time, 1: High, 2: Low
    status VARCHAR(20) DEFAULT 'queued',
    result JSONB,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_jobs_status_priority ON jobs(status, priority);
CREATE INDEX idx_jobs_user_id ON jobs(user_id);
