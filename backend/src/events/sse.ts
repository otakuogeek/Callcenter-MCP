import { Response, Request } from 'express';

type ChannelName = 'queue' | 'transfers';

interface Client {
  res: Response;
  heartbeat: NodeJS.Timeout;
}

const channels: Record<ChannelName, Set<Client>> = {
  queue: new Set<Client>(),
  transfers: new Set<Client>(),
};

// Contadores simples en memoria (reinician al reiniciar el proceso)
const eventsCounter: Record<ChannelName, number> = { queue: 0, transfers: 0 };
let connectionsAccepted = 0;
let connectionsClosed = 0;

function writeEvent(res: Response, event: string, data: any) {
  try {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    res.write(`event: ${event}\n`);
    res.write(`data: ${payload}\n\n`);
  } catch {
    // ignore
  }
}

export function subscribe(channel: ChannelName, req: Request, res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  // Evitar buffering por proxies intermedios / Nginx
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Transfer-Encoding', 'chunked');
  // Sugerir retry base al cliente (fallback manejado en frontend también)
  res.write('retry: 5000\n');
  ;(res as any).flushHeaders?.();

  // Initial comment to open stream
  res.write(`: connected to ${channel}\n\n`);

  const heartbeat = setInterval(() => {
    try { res.write(`: ping\n\n`); } catch { /* ignore */ }
  }, 25000);

  const client: Client = { res, heartbeat };
  channels[channel].add(client);
  connectionsAccepted++;

  ;(req as any).on('close', () => {
    clearInterval(heartbeat);
    channels[channel].delete(client);
  connectionsClosed++;
  });
}

export function publish(channel: ChannelName, event: string, data: any) {
  const set = channels[channel];
  for (const client of set) {
    writeEvent(client.res, event, data);
  }
  eventsCounter[channel] += 1;
}

export function getChannelSize(channel: ChannelName): number {
  return channels[channel].size;
}

export function getAllChannelSizes() {
  return {
    queue: channels.queue.size,
    transfers: channels.transfers.size,
  };
}

export function getSSEMetrics() {
  return {
    connections: getAllChannelSizes(),
    events: { ...eventsCounter },
    totals: { accepted: connectionsAccepted, closed: connectionsClosed },
    uptime_seconds: process.uptime(),
  };
}

export function renderPrometheusMetrics() {
  const sizes = getAllChannelSizes();
  const metrics = [
    `# HELP sse_channel_connections Número de conexiones activas por canal SSE`,
    `# TYPE sse_channel_connections gauge`,
    `sse_channel_connections{channel="queue"} ${sizes.queue}`,
    `sse_channel_connections{channel="transfers"} ${sizes.transfers}`,
    `# HELP sse_events_total Eventos SSE enviados por canal (publish)`,
    `# TYPE sse_events_total counter`,
    `sse_events_total{channel="queue"} ${eventsCounter.queue}`,
    `sse_events_total{channel="transfers"} ${eventsCounter.transfers}`,
    `# HELP sse_connections_accepted_total Conexiones SSE aceptadas acumuladas`,
    `# TYPE sse_connections_accepted_total counter`,
    `sse_connections_accepted_total ${connectionsAccepted}`,
    `# HELP sse_connections_closed_total Conexiones SSE cerradas (detectadas)`,
    `# TYPE sse_connections_closed_total counter`,
    `sse_connections_closed_total ${connectionsClosed}`,
    `# HELP process_uptime_seconds Uptime del proceso en segundos`,
    `# TYPE process_uptime_seconds gauge`,
    `process_uptime_seconds ${process.uptime().toFixed(0)}`,
  ];
  return metrics.join('\n') + '\n';
}
