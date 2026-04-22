import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { 
  Activity, 
  Cpu, 
  Clock, 
  Zap, 
  Server, 
  Plus, 
  Layers,
  AlertCircle,
  CheckCircle2,
  Terminal
} from 'lucide-react';
import './index.css';

const socket = io('http://localhost:3001');

function App() {
  const [systemState, setSystemState] = useState({
    workers: [],
    queue: [],
    activeJobs: [],
    avgLatencySec: 0,
    throughput: 0,
    utilization: 0,
    queueLength: 0
  });
  
  const [logs, setLogs] = useState([]);
  const [jobProgress, setJobProgress] = useState({});
  const logsEndRef = useRef(null);

  const [formData, setFormData] = useState({
    type: 'image_processing',
    priority: 'low',
    payload: 'Sample Payload'
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    socket.on('systemState', (state) => {
      setSystemState(state);
    });

    socket.on('jobLog', (log) => {
      setLogs((prev) => [...prev, log].slice(-100)); // Keep last 100 logs
    });

    socket.on('jobProgress', ({ id, progress }) => {
      setJobProgress(prev => ({ ...prev, [id]: progress }));
    });

    return () => {
      socket.off('systemState');
      socket.off('jobLog');
      socket.off('jobProgress');
    };
  }, []);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch('http://localhost:3001/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      console.log('Job submitted:', data);
    } catch (error) {
      console.error('Error submitting job:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'completed': return <CheckCircle2 size={14} />;
      case 'failed': return <AlertCircle size={14} />;
      case 'running': return <Activity size={14} className="animate-pulse" />;
      default: return <Clock size={14} />;
    }
  };

  return (
    <>
      <header className="dashboard-header">
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Zap size={32} color="#a78bfa" fill="#60a5fa" />
            Mini GPUaaS
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>AI-Powered Distributed Inference & Job Scheduling Platform</p>
        </div>
      </header>

      <div className="dashboard-grid">
        <main className="main-content">
          {/* Metrics Grid */}
          <div className="metrics-grid">
            <div className="glass metric-card">
              <div className="metric-label">Avg. Processing Latency</div>
              <div className="metric-value text-gradient">{systemState.avgLatencySec}s</div>
            </div>
            <div className="glass metric-card">
              <div className="metric-label">Active Queue Length</div>
              <div className="metric-value" style={{ color: '#f59e0b' }}>{systemState.queueLength}</div>
            </div>
            <div className="glass metric-card">
              <div className="metric-label">Available Workers</div>
              <div className="metric-value">
                {systemState.workers.filter(w => !w.isBusy).length} / {systemState.workers.length}
              </div>
            </div>
            <div className="glass metric-card">
              <div className="metric-label">Throughput</div>
              <div className="metric-value text-gradient">{systemState.throughput} j/s</div>
            </div>
            <div className="glass metric-card">
              <div className="metric-label">Worker Utilization</div>
              <div className="metric-value text-gradient">{systemState.utilization}%</div>
            </div>
          </div>

          {/* Workers Status */}
          <div className="glass" style={{ padding: '24px' }}>
            <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Server size={20} className="text-gradient" /> Worker Nodes
            </h2>
            <div className="workers-grid">
              {systemState.workers.map((worker) => (
                <div key={worker.id} className={`glass worker-card ${worker.isBusy ? 'busy' : ''}`}>
                  <div className="worker-icon-wrapper">
                    <Cpu size={30} className={worker.isBusy ? 'animate-pulse' : ''} />
                  </div>
                  <h3>{worker.id}</h3>
                  <div className={`status-badge ${worker.isBusy ? 'running' : 'completed'}`}>
                    {worker.isBusy ? 'Processing...' : 'Idle'}
                  </div>
                  {worker.isBusy && (
                     <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                       Job: {worker.currentJob.substring(0, 8)}...
                     </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Active Jobs */}
          <div className="glass" style={{ padding: '24px' }}>
             <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={20} className="text-gradient" /> Job Queue & History
            </h2>
            <div className="queue-list">
              {systemState.activeJobs.slice(0, 5).map((job) => (
                <div key={job.id} className="job-item">
                  <div className="job-item-header">
                    <div>
                      <h4 style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Job {job.id.substring(0, 8)}...
                        <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                          Priority: {job.priorityName}
                        </span>
                      </h4>
                    </div>
                    <div className={`status-badge ${job.status}`}>
                      {getStatusIcon(job.status)} {job.status}
                    </div>
                  </div>
                  {job.status === 'running' && jobProgress[job.id] !== undefined && (
                    <div className="progress-bar-container">
                      <div className="progress-bar" style={{ width: `${jobProgress[job.id]}%` }}></div>
                    </div>
                  )}
                </div>
              ))}
              {systemState.activeJobs.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No jobs processed yet.
                </div>
              )}
            </div>
          </div>
        </main>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Submit Job Form */}
          <div className="glass" style={{ padding: '24px' }}>
            <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={20} className="text-gradient" /> Submit Task
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label className="input-label">Task Type</label>
                <select 
                  className="select" 
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value})}
                >
                  <option value="image_processing">Image Processing (Slow)</option>
                  <option value="nlp">NLP Inference (Fast)</option>
                  <option value="training">Model Training Epoch (Very Slow)</option>
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Priority</label>
                <select 
                  className="select"
                  value={formData.priority}
                  onChange={e => setFormData({...formData, priority: e.target.value})}
                >
                  <option value="low">Low (Background)</option>
                  <option value="high">High</option>
                  <option value="real-time">Real-Time (Urgent)</option>
                </select>
              </div>

              <button 
                type="submit" 
                className="button" 
                style={{ width: '100%', marginTop: '10px' }}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Queue Job'}
              </button>
            </form>
          </div>

          {/* Live Logs */}
          <div className="glass" style={{ padding: '24px', flex: 1 }}>
            <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={20} className="text-gradient" /> Console Logs
            </h2>
            <div className="logs-container">
              {logs.map((log, index) => (
                <div key={index} className="log-entry">
                  <span style={{ color: '#60a5fa' }}>{log.id.substring(0, 8)}</span>: {log.message}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

export default App;
