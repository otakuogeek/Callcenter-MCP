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
  ;(res as any).flushHeaders?.();

  // Initial comment to open stream
  res.write(`: connected to ${channel}\n\n`);

  const heartbeat = setInterval(() => {
    try { res.write(`: ping\n\n`); } catch { /* ignore */ }
  }, 25000);

  const client: Client = { res, heartbeat };
  channels[channel].add(client);

  ;(req as any).on('close', () => {
    clearInterval(heartbeat);
    channels[channel].delete(client);
  });
}

export function publish(channel: ChannelName, event: string, data: any) {
  const set = channels[channel];
  for (const client of set) {
    writeEvent(client.res, event, data);
  }
}

export function getChannelSize(channel: ChannelName): number {
  return channels[channel].size;
}
