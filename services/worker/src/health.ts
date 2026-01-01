import http from 'http';
import { workers } from './processors/main';

export const server = http.createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    const allHealthy = workers.every(w => !w.closing && !w.closed);

    res.writeHead(allHealthy ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: allHealthy ? 'healthy' : 'unhealthy',
      workers: workers.map(w => ({ name: w.name, running: !w.closed }))
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(3001, () => {
  console.log('Health check server listening on port 3001');
});
