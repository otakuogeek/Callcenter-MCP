'use strict';
// ====================================================================
// BIOSANAR CLUSTER MONITOR - Backend
// Puerto 5055 | JWT Auth | SSE Real-time
// ====================================================================
const express    = require('express');
const cors       = require('cors');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const { exec }   = require('child_process');
const path       = require('path');
const fs         = require('fs');
const si         = require('systeminformation');
const { NodeSSH } = require('node-ssh');

const app  = express();
const PORT = process.env.MONITOR_PORT || 5055;
const JWT_SECRET = process.env.MONITOR_JWT_SECRET || 'biosanar_monitor_secret_2026';

// ── Config servidores ──────────────────────────────────────────────
const SERVERS = {
  s1: { label: 'Server 1 (Master)', ip: '127.0.0.1',    role: 'master', local: true  },
  s2: { label: 'Server 2 (Réplica)', ip: '72.62.164.88', role: 'slave',  local: false,
        ssh: { host: '72.62.164.88', username: 'root', password: 'Silv5514@cor' } }
};

// ── Usuarios del panel ─────────────────────────────────────────────
// Hash de 'admin2026!' - cambiar con: node -e "require('bcryptjs').hash('TU_PASS',10).then(console.log)"
const USERS = [
  { id: 1, username: 'admin',   passwordHash: bcrypt.hashSync('admin2026!', 10), role: 'superadmin' },
  { id: 2, username: 'monitor', passwordHash: bcrypt.hashSync('monitor123', 10), role: 'readonly'   }
];

// ── Middlewares ────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization || (req.query.token ? `Bearer ${req.query.token}` : '');
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Token inválido' }); }
};

// ── Cache de métricas ──────────────────────────────────────────────
const cache = { s1: {}, s2: {}, lastUpdate: null };
const sseClients = new Set();

// ── Sistema de Incidentes ─────────────────────────────────────────
const INCIDENTS_FILE = path.join(__dirname, '../data/incidents.json');
const INCIDENTS_MAX = 500; // max incidents to keep

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Load existing incidents
let incidents = [];
try {
  if (fs.existsSync(INCIDENTS_FILE)) {
    incidents = JSON.parse(fs.readFileSync(INCIDENTS_FILE, 'utf-8'));
  }
} catch { incidents = []; }

// Track previous state for change detection
let prevState = {
  s1_online: true, s2_online: true,
  s1_nginx: true, s1_db: true, s2_db: true,
  s1_redis: true, s1_nfs: true,
  repl_io: true, repl_sql: true,
  s1_pm2: {}, s2_pm2: {}
};

function saveIncidents() {
  try {
    if (incidents.length > INCIDENTS_MAX) incidents = incidents.slice(-INCIDENTS_MAX);
    fs.writeFileSync(INCIDENTS_FILE, JSON.stringify(incidents, null, 2));
  } catch (e) { console.error('[Incidents] Error saving:', e.message); }
}

function addIncident(severity, category, title, details = '') {
  const incident = {
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    timestamp: new Date().toISOString(),
    severity,    // critical | warning | info | resolved
    category,    // server | database | replication | service | network
    title,
    details,
    resolved: severity === 'resolved',
    resolvedAt: severity === 'resolved' ? new Date().toISOString() : null
  };
  incidents.push(incident);
  saveIncidents();

  // Broadcast incident via SSE
  broadcastSSE({ type: 'incident', incident });
  console.log(`[Incident] ${severity.toUpperCase()} — ${title}`);
  return incident;
}

function detectIncidents(s1, s2) {
  // ── Server Online Status ──
  if (prevState.s1_online && !s1?.online) {
    addIncident('critical', 'server', 'Server 1 (Master) caído', `El nodo principal no responde. Error: ${s1?.error || 'Sin respuesta'}`);
  } else if (!prevState.s1_online && s1?.online) {
    addIncident('resolved', 'server', 'Server 1 (Master) recuperado', 'El nodo principal volvió a estar en línea.');
  }

  if (prevState.s2_online && !s2?.online) {
    addIncident('critical', 'server', 'Server 2 (Réplica) caído', `El nodo réplica no responde. Error: ${s2?.error || 'Sin respuesta'}`);
  } else if (!prevState.s2_online && s2?.online) {
    addIncident('resolved', 'server', 'Server 2 (Réplica) recuperado', 'El nodo réplica volvió a estar en línea.');
  }

  // ── Nginx ──
  const s1Nginx = s1?.nginx?.running ?? false;
  if (prevState.s1_nginx && !s1Nginx) {
    addIncident('critical', 'service', 'Nginx caído en S1', 'El balanceador de carga dejó de funcionar.');
  } else if (!prevState.s1_nginx && s1Nginx) {
    addIncident('resolved', 'service', 'Nginx restaurado en S1', 'El balanceador volvió a funcionar.');
  }

  // ── Database S1 ──
  const s1Db = s1?.database?.running ?? false;
  if (prevState.s1_db && !s1Db) {
    addIncident('critical', 'database', 'MariaDB caído en S1 (Master)', 'La base de datos principal dejó de responder.');
  } else if (!prevState.s1_db && s1Db) {
    addIncident('resolved', 'database', 'MariaDB restaurado en S1 (Master)', 'La base de datos principal volvió a funcionar.');
  }

  // ── Database S2 ──
  const s2Db = s2?.database?.running ?? false;
  if (prevState.s2_db && !s2Db) {
    addIncident('warning', 'database', 'MariaDB caído en S2 (Slave)', 'La base de datos réplica dejó de responder.');
  } else if (!prevState.s2_db && s2Db) {
    addIncident('resolved', 'database', 'MariaDB restaurado en S2 (Slave)', 'La base de datos réplica volvió a funcionar.');
  }

  // ── Redis ──
  const s1Redis = s1?.redis?.running ?? false;
  if (prevState.s1_redis && !s1Redis) {
    addIncident('warning', 'service', 'Redis caído en S1', 'El servicio de caché dejó de responder.');
  } else if (!prevState.s1_redis && s1Redis) {
    addIncident('resolved', 'service', 'Redis restaurado en S1', 'El servicio de caché volvió a funcionar.');
  }

  // ── NFS ──
  const s1Nfs = s1?.nfs?.running ?? false;
  if (prevState.s1_nfs && !s1Nfs) {
    addIncident('warning', 'service', 'NFS caído en S1', 'El servicio de archivos compartidos dejó de responder.');
  } else if (!prevState.s1_nfs && s1Nfs) {
    addIncident('resolved', 'service', 'NFS restaurado en S1', 'El servicio de archivos compartidos volvió a funcionar.');
  }

  // ── Replication IO Thread ──
  const replIo = s2?.replication?.ioRunning === 'Yes';
  if (prevState.repl_io && !replIo && s2?.online) {
    addIncident('critical', 'replication', 'IO Thread de replicación detenido', `Slave_IO_Running: ${s2?.replication?.ioRunning || 'No'}. ${s2?.replication?.lastError || ''}`);
  } else if (!prevState.repl_io && replIo) {
    addIncident('resolved', 'replication', 'IO Thread de replicación restaurado', 'La replicación IO volvió a funcionar.');
  }

  // ── Replication SQL Thread ──
  const replSql = s2?.replication?.sqlRunning === 'Yes';
  if (prevState.repl_sql && !replSql && s2?.online) {
    addIncident('critical', 'replication', 'SQL Thread de replicación detenido', `Slave_SQL_Running: ${s2?.replication?.sqlRunning || 'No'}. ${s2?.replication?.lastError || ''}`);
  } else if (!prevState.repl_sql && replSql) {
    addIncident('resolved', 'replication', 'SQL Thread de replicación restaurado', 'La replicación SQL volvió a funcionar.');
  }

  // ── Replication Lag (warning if > 30s) ──
  const lag = s2?.replication?.secondsBehind;
  if (typeof lag === 'number' && lag > 30) {
    // Only warn every 60s (check last incident)
    const lastLagIncident = incidents.filter(i => i.category === 'replication' && i.title.includes('Lag')).pop();
    if (!lastLagIncident || (Date.now() - new Date(lastLagIncident.timestamp).getTime()) > 60000) {
      addIncident('warning', 'replication', `Lag de replicación alto: ${lag}s`, `El slave está ${lag} segundos detrás del master.`);
    }
  }

  // ── High CPU (>90%) ──
  if (s1?.online && s1?.cpu > 90) {
    const last = incidents.filter(i => i.title.includes('CPU alto S1')).pop();
    if (!last || (Date.now() - new Date(last.timestamp).getTime()) > 120000) {
      addIncident('warning', 'server', `CPU alto S1: ${s1.cpu.toFixed(1)}%`, 'El servidor principal tiene carga de CPU elevada.');
    }
  }
  if (s2?.online && s2?.cpu > 90) {
    const last = incidents.filter(i => i.title.includes('CPU alto S2')).pop();
    if (!last || (Date.now() - new Date(last.timestamp).getTime()) > 120000) {
      addIncident('warning', 'server', `CPU alto S2: ${s2.cpu.toFixed(1)}%`, 'El servidor réplica tiene carga de CPU elevada.');
    }
  }

  // ── High RAM (>95%) ──
  if (s1?.online && s1?.memory?.percent > 95) {
    const last = incidents.filter(i => i.title.includes('RAM alto S1')).pop();
    if (!last || (Date.now() - new Date(last.timestamp).getTime()) > 120000) {
      addIncident('warning', 'server', `RAM alto S1: ${s1.memory.percent}%`, `Uso de memoria: ${s1.memory.used}/${s1.memory.total} MB`);
    }
  }
  if (s2?.online && s2?.memory?.percent > 95) {
    const last = incidents.filter(i => i.title.includes('RAM alto S2')).pop();
    if (!last || (Date.now() - new Date(last.timestamp).getTime()) > 120000) {
      addIncident('warning', 'server', `RAM alto S2: ${s2.memory.percent}%`, `Uso de memoria: ${s2.memory.used}/${s2.memory.total} MB`);
    }
  }

  // ── PM2 process crashes ──
  const checkPM2 = (procs, serverId, prevPm2) => {
    if (!procs) return {};
    const newState = {};
    for (const p of procs) {
      newState[p.name] = p.status;
      const wasOnline = prevPm2[p.name] === 'online';
      if (wasOnline && p.status !== 'online') {
        addIncident('critical', 'service', `PM2 "${p.name}" caído en ${serverId}`, `Estado: ${p.status}. Reinicios: ${p.restarts}`);
      } else if (!wasOnline && prevPm2[p.name] && p.status === 'online') {
        addIncident('resolved', 'service', `PM2 "${p.name}" restaurado en ${serverId}`, `El proceso volvió a estar en línea. Reinicios: ${p.restarts}`);
      }
    }
    return newState;
  };

  const newS1Pm2 = checkPM2(s1?.pm2, 'S1', prevState.s1_pm2);
  const newS2Pm2 = checkPM2(s2?.pm2, 'S2', prevState.s2_pm2);

  // Update previous state
  prevState = {
    s1_online: s1?.online ?? false,
    s2_online: s2?.online ?? false,
    s1_nginx: s1Nginx,
    s1_db: s1Db, s2_db: s2Db,
    s1_redis: s1Redis, s1_nfs: s1Nfs,
    repl_io: replIo, repl_sql: replSql,
    s1_pm2: newS1Pm2, s2_pm2: newS2Pm2
  };
}

// ── Helper: ejecutar comando local ────────────────────────────────
const execLocal = (cmd) => new Promise((resolve) => {
  exec(cmd, { timeout: 8000 }, (err, stdout) => resolve(err ? '' : stdout.trim()));
});

// ── Helper: ejecutar comando en Server 2 via SSH ──────────────────
const sshCache = { conn: null, lastConnected: 0 };
const execRemote = async (cmd) => {
  try {
    const now = Date.now();
    if (!sshCache.conn || (now - sshCache.lastConnected) > 60000) {
      const ssh = new NodeSSH();
      await ssh.connect({ host: '72.62.164.88', username: 'root', password: 'Silv5514@cor',
        readyTimeout: 8000, keepaliveInterval: 30000 });
      sshCache.conn = ssh;
      sshCache.lastConnected = now;
    }
    const result = await sshCache.conn.execCommand(cmd, { execOptions: { pty: false } });
    return result.stdout ? result.stdout.trim() : '';
  } catch (e) {
    sshCache.conn = null;
    return '';
  }
};

// ── Recolectar métricas de un servidor ───────────────────────────
const collectMetrics = async (serverId) => {
  const srv    = SERVERS[serverId];
  const isLocal = srv.local;
  const run    = isLocal ? execLocal : execRemote;

  try {
    // --- CPU ---
    const cpuRaw = isLocal
      ? await (async () => {
          const load = await si.currentLoad();
          return load.currentLoad.toFixed(1);
        })()
      : await run("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1");

    // --- Memoria ---
    const memRaw    = await run("free -m | awk '/^Mem/ {printf \"%d %d %d\", $2, $3, $4}'");
    const memParts  = (memRaw || '0 0 0').split(' ').map(Number);

    // --- Disco ---
    const diskRaw   = await run("df -h / | awk 'NR==2 {print $2\" \"$3\" \"$5}'");

    // --- Uptime ---
    const uptime    = await run("uptime -p 2>/dev/null || uptime | awk -F',' '{print $1}' | sed 's/.*up //'");

    // --- Red (bytes enviados/recibidos en eth0/ens3/etc.) ---
    const netRaw    = await run("cat /proc/net/dev | grep -E 'eth0|ens|enp' | awk '{print $2\" \"$10}' | head -1");
    const netParts  = (netRaw || '0 0').split(' ').map(Number);

    // --- PM2 ---
    const pm2Raw    = await run("pm2 jlist 2>/dev/null || echo '[]'");
    let pm2Procs    = [];
    try { pm2Procs = JSON.parse(pm2Raw || '[]'); } catch {}
    const pm2List   = pm2Procs.map(p => ({
      name:   p.name,
      status: p.pm2_env?.status || 'unknown',
      cpu:    p.monit?.cpu ?? 0,
      memory: Math.round((p.monit?.memory ?? 0) / 1024 / 1024),
      uptime: p.pm2_env?.pm_uptime ? Date.now() - p.pm2_env.pm_uptime : 0,
      restarts: p.pm2_env?.restart_time ?? 0
    }));

    // --- Nginx ---
    const nginxUp   = await run("systemctl is-active nginx 2>/dev/null");
    const nginxConn = await run("curl -s --max-time 2 http://127.0.0.1/nginx_status 2>/dev/null | grep 'Active connections' | awk '{print $3}'");
    const nginxReqs = await run("tail -100 /var/log/nginx/biosanarcall.site.access.log 2>/dev/null | wc -l");

    // --- MariaDB ---
    const dbUp      = await run("systemctl is-active mariadb 2>/dev/null");
    const dbConns   = await run("mysql -u root -se 'SHOW GLOBAL STATUS LIKE \"Threads_connected\";' 2>/dev/null | awk '{print $2}'");
    const dbQPS     = await run("mysql -u root -se 'SHOW GLOBAL STATUS LIKE \"Questions\";' 2>/dev/null | awk '{print $2}'");

    // --- Replicación ---
    let replication = null;
    if (serverId === 's1') {
      const masterStatus = await run("mysql -u root -se 'SHOW MASTER STATUS\\G' 2>/dev/null");
      const binlogFile   = (masterStatus.match(/File:\s+(\S+)/) || [])[1] || '';
      const binlogPos    = (masterStatus.match(/Position:\s+(\d+)/) || [])[1] || '0';
      replication = { role: 'master', binlogFile, binlogPos: parseInt(binlogPos) };
    } else {
      const slaveStatus  = await run("mysql -u root -e 'SHOW SLAVE STATUS\\G' 2>/dev/null");
      const ioRunning    = (slaveStatus.match(/Slave_IO_Running:\s+(\w+)/) || [])[1] || 'No';
      const sqlRunning   = (slaveStatus.match(/Slave_SQL_Running:\s+(\w+)/) || [])[1] || 'No';
      const secondsBehind= (slaveStatus.match(/Seconds_Behind_Master:\s+(\d+|NULL)/) || [])[1] || 'NULL';
      const lastError    = (slaveStatus.match(/Last_Error:\s+(.+)/) || [])[1]?.trim() || '';
      replication = { role: 'slave', ioRunning, sqlRunning,
        secondsBehind: secondsBehind === 'NULL' ? null : parseInt(secondsBehind), lastError };
    }

    // --- Redis (solo S1) ---
    let redis = null;
    if (isLocal) {
      const redisInfo = await run("redis-cli INFO server 2>/dev/null | head -5");
      const redisClients = await run("redis-cli INFO clients 2>/dev/null | grep connected_clients | awk -F: '{print $2}'");
      redis = {
        running: !!redisInfo && redisInfo.includes('redis_version'),
        clients: parseInt(redisClients || '0') || 0
      };
    }

    // --- NFS (solo S1) ---
    let nfs = null;
    if (isLocal) {
      const nfsStatus = await run("systemctl is-active nfs-kernel-server 2>/dev/null");
      const nfsExports = await run("exportfs -v 2>/dev/null | wc -l");
      nfs = { running: nfsStatus.trim() === 'active', exports: parseInt(nfsExports || '0') };
    }

    // --- Carga del load balancer (solo S1, via log de nginx) ---
    let lbStats = null;
    if (isLocal) {
      const lb1 = await run("tail -1000 /var/log/nginx/biosanarcall.site.access.log 2>/dev/null | grep -c '127.0.0.1' || echo 0");
      const lb2 = await run("tail -1000 /var/log/nginx/biosanarcall.site.access.log 2>/dev/null | grep -c '72.62.164.88' || echo 0");
      lbStats = { s1: parseInt(lb1 || '0'), s2: parseInt(lb2 || '0') };
    }

    // --- Failover status (S2) ---
    let failoverStatus = null;
    if (!isLocal) {
      const failActive = await run("cat /tmp/failover_active 2>/dev/null || echo ''");
      const lastLog    = await run("tail -3 /var/log/biosanar-failover.log 2>/dev/null || echo ''");
      failoverStatus   = { active: failActive.includes('FAILOVER_ACTIVE'), lastLog };
    }

    return {
      id:        serverId,
      label:     srv.label,
      role:      srv.role,
      ip:        srv.ip,
      online:    true,
      timestamp: Date.now(),
      cpu:       parseFloat(cpuRaw || '0') || 0,
      memory: {
        total:   memParts[0] || 0,
        used:    memParts[1] || 0,
        free:    memParts[2] || 0,
        percent: memParts[0] ? Math.round(memParts[1] / memParts[0] * 100) : 0
      },
      disk:    { raw: diskRaw || 'N/A' },
      uptime:  uptime || 'N/A',
      network: { rxBytes: netParts[0] || 0, txBytes: netParts[1] || 0 },
      pm2:     pm2List,
      nginx:   { running: nginxUp.trim() === 'active', connections: parseInt(nginxConn || '0'), recentRequests: parseInt(nginxReqs || '0') },
      database: { running: dbUp.trim() === 'active', connections: parseInt(dbConns || '0'), questions: parseInt(dbQPS || '0') },
      replication,
      redis,
      nfs,
      lbStats,
      failoverStatus
    };
  } catch (e) {
    return { id: serverId, label: srv.label, role: srv.role, ip: srv.ip, online: false,
      error: e.message, timestamp: Date.now() };
  }
};

// ── Actualizar cache cada 5 segundos ─────────────────────────────
let collecting = false;
const refreshMetrics = async () => {
  if (collecting) return;
  collecting = true;
  try {
    const [s1, s2] = await Promise.all([collectMetrics('s1'), collectMetrics('s2')]);
    cache.s1 = s1;
    cache.s2 = s2;
    cache.lastUpdate = Date.now();

    // Detect incidents from metrics changes
    detectIncidents(s1, s2);

    // Enviar a todos los clientes SSE
    const payload = `data: ${JSON.stringify({ s1, s2, lastUpdate: cache.lastUpdate })}\n\n`;
    sseClients.forEach(client => client.res.write(payload));
  } finally {
    collecting = false;
  }
};

setInterval(refreshMetrics, 5000);
refreshMetrics(); // Primera carga

// ══════════════════════════════════════════════════════════════════
// RUTAS API
// ══════════════════════════════════════════════════════════════════

// ── Login ─────────────────────────────────────────────────────────
app.post('/monitor-api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Credenciales requeridas' });

  const user = USERS.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.passwordHash))
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role },
    JWT_SECRET, { expiresIn: '8h' });

  res.json({ token, user: { id: user.id, username: user.username, role: user.role }, expiresIn: 28800 });
});

// ── Métricas snapshot ─────────────────────────────────────────────
app.get('/monitor-api/metrics', authMiddleware, (req, res) => {
  res.json({ s1: cache.s1, s2: cache.s2, lastUpdate: cache.lastUpdate });
});

// ── SSE - Stream en tiempo real ───────────────────────────────────
app.get('/monitor-api/stream', authMiddleware, (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Enviar datos actuales inmediatamente
  if (cache.lastUpdate)
    res.write(`data: ${JSON.stringify({ s1: cache.s1, s2: cache.s2, lastUpdate: cache.lastUpdate })}\n\n`);

  const clientId = Date.now();
  sseClients.add({ id: clientId, res });

  // Heartbeat cada 25s para mantener conexión viva
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch { clearInterval(heartbeat); }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.forEach(c => { if (c.id === clientId) sseClients.delete(c); });
  });
});

// ── Ejecutar acción en servidor ───────────────────────────────────
app.post('/monitor-api/action', authMiddleware, async (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Solo superadmin' });

  const { server, action } = req.body || {};
  const ALLOWED_ACTIONS = {
    'restart-backend-s1': 'pm2 restart cita-central-backend 2>&1 | tail -5',
    'restart-backend-s2': null, // se ejecuta remoto
    'reload-nginx-s1':    'systemctl reload nginx && echo OK',
    'check-replication':  "mysql -u root -e 'SHOW SLAVE STATUS\\G' 2>/dev/null | grep -E 'IO_Running|SQL_Running|Seconds_Behind'",
    'sync-ssl':           'bash /opt/biosanar/ssl-sync-to-s2.sh 2>&1 | tail -5',
    'failover-status':    'cat /tmp/failover_active 2>/dev/null && tail -5 /var/log/biosanar-failover.log 2>/dev/null || echo "Sin failover activo"'
  };

  const key = `${action}-${server}`;
  if (!ALLOWED_ACTIONS[key] && !ALLOWED_ACTIONS[action])
    return res.status(400).json({ error: 'Acción no permitida' });

  try {
    let output;
    if (server === 's2' && action === 'restart-backend') {
      output = await execRemote('pm2 restart cita-central-backend 2>&1 | tail -5');
    } else {
      const cmd = ALLOWED_ACTIONS[key] || ALLOWED_ACTIONS[action];
      output = await execLocal(cmd);
    }
    res.json({ success: true, output, timestamp: Date.now() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Info de configuración ─────────────────────────────────────────
app.get('/monitor-api/config', authMiddleware, async (req, res) => {
  const nginxConf   = await execLocal("grep -E 'server|weight|fail_timeout|upstream' /etc/nginx/sites-enabled/biosanarcall.site 2>/dev/null | head -20");
  const sslExpiry   = await execLocal("openssl x509 -enddate -noout -in /etc/letsencrypt/live/biosanarcall.site/cert.pem 2>/dev/null | cut -d= -f2");
  const domainIP    = await execLocal("dig biosanarcall.site A +short 2>/dev/null | head -1");
  const replicationOk = cache.s2?.replication?.ioRunning === 'Yes' && cache.s2?.replication?.sqlRunning === 'Yes';

  res.json({
    domain: { name: 'biosanarcall.site', currentIP: domainIP, ttl: '(ver en Hostinger)' },
    ssl: { domain: 'biosanarcall.site', expiry: sslExpiry || 'N/A' },
    loadBalancer: {
      algorithm: 'least_conn',
      upstream: nginxConf,
      s1Weight: 2, s2Weight: 1
    },
    replication: {
      type: 'MariaDB Master→Slave',
      ok:   replicationOk,
      mode: 'Binlog + GTID-compatible',
      s1:   { host: '82.29.62.188', role: 'master' },
      s2:   { host: '72.62.164.88', role: 'slave', readOnly: true }
    },
    nfs: { server: '82.29.62.188', exports: '/home/ubuntu/app/backend/uploads', mountedOn: '72.62.164.88' },
    failover: {
      mechanism: 'Cron script cada 30s en Server 2',
      maxDowntime: '~90 segundos para failover de BD',
      dnsManual: 'Hostinger DNS → cambiar A record a 72.62.164.88'
    }
  });
});

// ── Incidentes API ────────────────────────────────────────────────
app.get('/monitor-api/incidents', authMiddleware, (req, res) => {
  const { severity, category, limit, since } = req.query;
  let filtered = [...incidents];
  if (severity) filtered = filtered.filter(i => i.severity === severity);
  if (category) filtered = filtered.filter(i => i.category === category);
  if (since) {
    const sinceMs = new Date(since).getTime();
    if (!isNaN(sinceMs)) filtered = filtered.filter(i => new Date(i.timestamp).getTime() >= sinceMs);
  }
  const max = Math.min(parseInt(limit) || 100, 500);
  filtered = filtered.slice(-max).reverse(); // newest first

  // Calculate uptime stats
  const now = Date.now();
  const h24 = now - 86400000;
  const h7d = now - 604800000;
  const criticals24h = incidents.filter(i => new Date(i.timestamp).getTime() >= h24 && i.severity === 'critical').length;
  const warnings24h = incidents.filter(i => new Date(i.timestamp).getTime() >= h24 && i.severity === 'warning').length;
  const criticals7d = incidents.filter(i => new Date(i.timestamp).getTime() >= h7d && i.severity === 'critical').length;

  res.json({
    incidents: filtered,
    stats: {
      total: incidents.length,
      criticals24h,
      warnings24h,
      criticals7d,
      activeIssues: incidents.filter(i => !i.resolved && i.severity !== 'resolved' && i.severity !== 'info').length
    }
  });
});

app.delete('/monitor-api/incidents', authMiddleware, (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Solo superadmin' });
  incidents = [];
  saveIncidents();
  res.json({ success: true, message: 'Historial de incidentes limpiado' });
});

// ── Stress Test Avanzado ──────────────────────────────────────────
// Pruebas de estrés con monitoreo de servidores en tiempo real,
// detección de failover, modos de prueba múltiples, percentiles
const http  = require('http');
const https = require('https');

const stressState = { running: false, results: null, abort: false };

// Helper: hacer una petición HTTP/HTTPS con tracking de servidor respondedor
const makeStressRequest = (url, method, body, timeout) => new Promise((resolve) => {
  const start = Date.now();
  const parsed = new URL(url);
  const mod = parsed.protocol === 'https:' ? https : http;
  const opts = {
    hostname: parsed.hostname,
    port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
    path: parsed.pathname + parsed.search,
    method: method || 'GET',
    timeout,
    rejectUnauthorized: false,
    headers: {
      'User-Agent': 'BiosanarStressTest/2.0',
      'Accept': 'application/json',
      ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {})
    }
  };

  const req = mod.request(opts, (resp) => {
    let data = '';
    const serverHeader = resp.headers['x-served-by'] || resp.headers['x-backend'] || resp.headers['server'] || '';
    resp.on('data', c => data += c);
    resp.on('end', () => resolve({
      ok: resp.statusCode < 500,
      status: resp.statusCode,
      latency: Date.now() - start,
      server: serverHeader,
      bytes: Buffer.byteLength(data)
    }));
  });
  req.on('error', (e) => resolve({ ok: false, status: 0, latency: Date.now() - start, error: e.code || e.message, server: '', bytes: 0 }));
  req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, latency: timeout, error: 'TIMEOUT', server: '', bytes: 0 }); });
  if (body) req.write(body);
  req.end();
});

// Helper: percentiles
const percentile = (arr, p) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a,b) => a-b);
  const idx = Math.ceil(sorted.length * p / 100) - 1;
  return sorted[Math.max(0, idx)];
};

// Helper: recoger métricas rápidas de ambos servidores
const getQuickMetrics = async () => {
  try {
    const [s1cpu, s1mem, s1conn, s2cpu, s2mem, s2conn] = await Promise.all([
      execLocal("grep 'cpu ' /proc/stat | awk '{u=$2+$4; t=$2+$4+$5; printf \"%.1f\", u*100/t}'"),
      execLocal("free -m | awk '/^Mem/{printf \"%.1f\", $3/$2*100}'"),
      execLocal("mysql -u root -se 'SHOW GLOBAL STATUS LIKE \"Threads_connected\";' 2>/dev/null | awk '{print $2}'"),
      execRemote("grep 'cpu ' /proc/stat | awk '{u=$2+$4; t=$2+$4+$5; printf \"%.1f\", u*100/t}'"),
      execRemote("free -m | awk '/^Mem/{printf \"%.1f\", $3/$2*100}'"),
      execRemote("mysql -u root -se 'SHOW GLOBAL STATUS LIKE \"Threads_connected\";' 2>/dev/null | awk '{print $2}'")
    ]);
    return {
      s1: { cpu: parseFloat(s1cpu) || 0, ram: parseFloat(s1mem) || 0, dbConn: parseInt(s1conn) || 0 },
      s2: { cpu: parseFloat(s2cpu) || 0, ram: parseFloat(s2mem) || 0, dbConn: parseInt(s2conn) || 0 }
    };
  } catch { return { s1: { cpu: 0, ram: 0, dbConn: 0 }, s2: { cpu: 0, ram: 0, dbConn: 0 } }; }
};

// Broadcast helper
const broadcastSSE = (data) => {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => { try { client.res.write(payload); } catch {} });
};

// ── POST /stress/start ─ Inicia prueba avanzada ─────────────────
app.post('/monitor-api/stress/start', authMiddleware, async (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Solo superadmin' });
  if (stressState.running) return res.status(409).json({ error: 'Ya hay una prueba en curso' });

  const {
    targetUrl = 'https://biosanarcall.site/api/lookups/specialties',
    maxConcurrent = 200,
    stepSize = 10,
    stepDelayMs = 2000,
    requestTimeoutMs = 10000,
    method = 'GET',
    postBody = null,
    mode = 'ramp',          // ramp | spike | endurance | find-limit
    enduranceDurationSec = 60,
    multiEndpoints = [],    // [{url, method, weight}]
    stopOnFailure = true    // auto-stop when <50% success
  } = req.body || {};

  stressState.running = true;
  stressState.abort = false;
  stressState.results = {
    targetUrl,
    mode,
    method,
    startTime: Date.now(),
    steps: [],
    serverMetrics: [],
    maxSustained: 0,
    breakingPoint: null,
    degradationPoint: null,
    failoverDetected: false,
    totalRequests: 0,
    totalBytes: 0,
    summary: null
  };

  const config = { targetUrl, maxConcurrent, stepSize, stepDelayMs, method, mode, requestTimeoutMs };
  res.json({ success: true, message: 'Prueba de estrés iniciada', config });

  // Background execution
  (async () => {
    const urls = multiEndpoints.length > 0 ? multiEndpoints : [{ url: targetUrl, method, weight: 1 }];
    const totalWeight = urls.reduce((s, u) => s + (u.weight || 1), 0);

    // Pick a URL based on weights
    const pickUrl = () => {
      let r = Math.random() * totalWeight;
      for (const u of urls) { r -= (u.weight || 1); if (r <= 0) return u; }
      return urls[0];
    };

    const runBatch = async (concurrent) => {
      const batchStart = Date.now();
      const promises = Array.from({ length: concurrent }, () => {
        const ep = pickUrl();
        return makeStressRequest(ep.url, ep.method || method, ep.method === 'POST' ? (postBody || '{}') : null, requestTimeoutMs);
      });
      const results = await Promise.all(promises);
      const batchDuration = Date.now() - batchStart;

      const latencies = results.map(r => r.latency);
      const successes = results.filter(r => r.ok).length;
      const failures  = results.filter(r => !r.ok).length;
      const totalBytes = results.reduce((s, r) => s + r.bytes, 0);

      const statusCodes = results.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
      const errorTypes  = results.filter(r => r.error).reduce((acc, r) => { acc[r.error] = (acc[r.error] || 0) + 1; return acc; }, {});

      return {
        concurrent,
        successes,
        failures,
        successRate: Math.round((successes / concurrent) * 100),
        avgLatency: Math.round(latencies.reduce((s,l) => s+l, 0) / latencies.length),
        minLatency: Math.min(...latencies.filter((_,i) => results[i].ok)) || 0,
        maxLatency: Math.max(...latencies),
        p50: percentile(latencies, 50),
        p95: percentile(latencies, 95),
        p99: percentile(latencies, 99),
        throughput: Math.round(successes / (batchDuration / 1000) * 10) / 10,
        totalBytes,
        statusCodes,
        errorTypes,
        batchDuration,
        timestamp: Date.now()
      };
    };

    // ── MODE: RAMP (Escalado gradual) ─────────────────────────────
    if (mode === 'ramp' || mode === 'find-limit') {
      const max = mode === 'find-limit' ? 2000 : maxConcurrent;  // find-limit escala hasta 2000
      for (let concurrent = stepSize; concurrent <= max; concurrent += stepSize) {
        if (stressState.abort) break;

        // Collect server metrics in parallel with requests
        const [stepResult, serverMetrics] = await Promise.all([
          runBatch(concurrent),
          getQuickMetrics()
        ]);

        stressState.results.steps.push(stepResult);
        stressState.results.serverMetrics.push({ ...serverMetrics, concurrent, timestamp: Date.now() });
        stressState.results.totalRequests += concurrent;
        stressState.results.totalBytes += stepResult.totalBytes;

        if (stepResult.successRate >= 90) stressState.results.maxSustained = concurrent;

        // Detect degradation point (latency > 2x first step avg)
        if (!stressState.results.degradationPoint && stressState.results.steps.length > 1) {
          const baseLatency = stressState.results.steps[0].avgLatency;
          if (stepResult.avgLatency > baseLatency * 3) {
            stressState.results.degradationPoint = concurrent;
          }
        }

        // Detect breaking point
        if (!stressState.results.breakingPoint && stepResult.successRate < 90) {
          stressState.results.breakingPoint = concurrent;
        }

        // Detect failover (if S2 CPU suddenly spikes or server header changes)
        if (serverMetrics.s2.cpu > 20 && stressState.results.serverMetrics.length > 2) {
          const prev = stressState.results.serverMetrics[stressState.results.serverMetrics.length - 3];
          if (prev && prev.s2.cpu < 5) stressState.results.failoverDetected = true;
        }

        broadcastSSE({
          type: 'stress_step',
          step: stepResult,
          serverMetrics,
          maxSustained: stressState.results.maxSustained,
          breakingPoint: stressState.results.breakingPoint,
          degradationPoint: stressState.results.degradationPoint,
          failoverDetected: stressState.results.failoverDetected
        });

        // Auto-stop if success drops below threshold
        if (stopOnFailure && stepResult.successRate < 50) {
          stressState.results.breakingPoint = stressState.results.breakingPoint || concurrent;
          break;
        }

        await new Promise(r => setTimeout(r, stepDelayMs));
      }
    }

    // ── MODE: SPIKE (Ráfaga repentina) ────────────────────────────
    else if (mode === 'spike') {
      // Phase 1: baseline with stepSize
      for (let i = 0; i < 3 && !stressState.abort; i++) {
        const [stepResult, serverMetrics] = await Promise.all([runBatch(stepSize), getQuickMetrics()]);
        stressState.results.steps.push(stepResult);
        stressState.results.serverMetrics.push({ ...serverMetrics, concurrent: stepSize, timestamp: Date.now() });
        broadcastSSE({ type: 'stress_step', step: stepResult, serverMetrics, maxSustained: stepSize, phase: 'baseline' });
        await new Promise(r => setTimeout(r, stepDelayMs));
      }

      // Phase 2: sudden spike to maxConcurrent
      if (!stressState.abort) {
        const [spikeResult, spikeMetrics] = await Promise.all([runBatch(maxConcurrent), getQuickMetrics()]);
        stressState.results.steps.push(spikeResult);
        stressState.results.serverMetrics.push({ ...spikeMetrics, concurrent: maxConcurrent, timestamp: Date.now() });
        stressState.results.totalRequests += maxConcurrent;
        if (spikeResult.successRate >= 90) stressState.results.maxSustained = maxConcurrent;
        broadcastSSE({ type: 'stress_step', step: spikeResult, serverMetrics: spikeMetrics, maxSustained: stressState.results.maxSustained, phase: 'spike' });

        await new Promise(r => setTimeout(r, stepDelayMs));

        // Phase 3: recovery check (back to stepSize)
        for (let i = 0; i < 3 && !stressState.abort; i++) {
          const [recResult, recMetrics] = await Promise.all([runBatch(stepSize), getQuickMetrics()]);
          stressState.results.steps.push(recResult);
          stressState.results.serverMetrics.push({ ...recMetrics, concurrent: stepSize, timestamp: Date.now() });
          broadcastSSE({ type: 'stress_step', step: recResult, serverMetrics: recMetrics, maxSustained: stressState.results.maxSustained, phase: 'recovery' });
          await new Promise(r => setTimeout(r, stepDelayMs));
        }
      }
    }

    // ── MODE: ENDURANCE (Carga sostenida) ─────────────────────────
    else if (mode === 'endurance') {
      const endMs = enduranceDurationSec * 1000;
      const endStart = Date.now();
      let iteration = 0;
      while (Date.now() - endStart < endMs && !stressState.abort) {
        iteration++;
        const [stepResult, serverMetrics] = await Promise.all([runBatch(maxConcurrent), getQuickMetrics()]);
        stressState.results.steps.push(stepResult);
        stressState.results.serverMetrics.push({ ...serverMetrics, concurrent: maxConcurrent, timestamp: Date.now() });
        stressState.results.totalRequests += maxConcurrent;
        if (stepResult.successRate >= 90) stressState.results.maxSustained = maxConcurrent;

        broadcastSSE({
          type: 'stress_step',
          step: { ...stepResult, iteration },
          serverMetrics,
          maxSustained: stressState.results.maxSustained,
          elapsed: Date.now() - endStart,
          remaining: Math.max(0, endMs - (Date.now() - endStart)),
          phase: 'endurance'
        });

        if (stopOnFailure && stepResult.successRate < 50) break;
        await new Promise(r => setTimeout(r, stepDelayMs));
      }
    }

    // ── Build Summary ──────────────────────────────────────────────
    const allLatencies = stressState.results.steps.flatMap(s => [s.p50, s.p95, s.p99]);
    const allThroughputs = stressState.results.steps.map(s => s.throughput);

    stressState.results.summary = {
      mode,
      totalSteps: stressState.results.steps.length,
      totalRequests: stressState.results.totalRequests,
      totalBytes: stressState.results.totalBytes,
      maxSustained: stressState.results.maxSustained,
      breakingPoint: stressState.results.breakingPoint,
      degradationPoint: stressState.results.degradationPoint,
      failoverDetected: stressState.results.failoverDetected,
      totalDuration: Date.now() - stressState.results.startTime,
      aborted: stressState.abort,
      peakThroughput: Math.max(...allThroughputs, 0),
      avgThroughput: allThroughputs.length ? Math.round(allThroughputs.reduce((s,t) => s+t, 0) / allThroughputs.length * 10) / 10 : 0,
      peakCPU_S1: Math.max(...stressState.results.serverMetrics.map(m => m.s1.cpu), 0),
      peakCPU_S2: Math.max(...stressState.results.serverMetrics.map(m => m.s2.cpu), 0),
      peakRAM_S1: Math.max(...stressState.results.serverMetrics.map(m => m.s1.ram), 0),
      peakRAM_S2: Math.max(...stressState.results.serverMetrics.map(m => m.s2.ram), 0),
      peakDBConn_S1: Math.max(...stressState.results.serverMetrics.map(m => m.s1.dbConn), 0),
      peakDBConn_S2: Math.max(...stressState.results.serverMetrics.map(m => m.s2.dbConn), 0)
    };

    broadcastSSE({ type: 'stress_done', results: stressState.results });
    stressState.running = false;
  })();
});

app.post('/monitor-api/stress/stop', authMiddleware, (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Solo superadmin' });
  if (!stressState.running) return res.status(400).json({ error: 'No hay prueba en curso' });
  stressState.abort = true;
  res.json({ success: true, message: 'Deteniendo prueba...' });
});

app.get('/monitor-api/stress/status', authMiddleware, (req, res) => {
  res.json({ running: stressState.running, results: stressState.results });
});

// Export last results as JSON download
app.get('/monitor-api/stress/export', authMiddleware, (req, res) => {
  if (!stressState.results) return res.status(404).json({ error: 'Sin resultados' });
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=stress-test-${Date.now()}.json`);
  res.json(stressState.results);
});

// ── Logs recientes ────────────────────────────────────────────────
app.get('/monitor-api/logs/:type', authMiddleware, async (req, res) => {
  const LOGS = {
    'nginx-access': 'tail -50 /var/log/nginx/biosanarcall.site.access.log 2>/dev/null',
    'nginx-error':  'tail -50 /var/log/nginx/biosanarcall.site.error.log 2>/dev/null',
    'backend-s1':   'pm2 logs cita-central-backend --lines 50 --nostream 2>/dev/null | tail -50',
    'failover':     'tail -50 /var/log/biosanar-failover.log 2>/dev/null',
    'replication':  "mysql -u root -e 'SHOW SLAVE STATUS\\G' 2>/dev/null"
  };
  const cmd = LOGS[req.params.type];
  if (!cmd) return res.status(404).json({ error: 'Log no encontrado' });
  const output = await execLocal(cmd);
  res.json({ type: req.params.type, lines: output.split('\n'), timestamp: Date.now() });
});

// ── Catch-all → index.html ────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── Arrancar ──────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Monitor] Biosanar Cluster Monitor corriendo en http://0.0.0.0:${PORT}`);
  console.log(`[Monitor] Usuarios: admin / admin2026!  |  monitor / monitor123`);
  console.log(`[Monitor] SSE activo - actualización cada 5 segundos`);
});
