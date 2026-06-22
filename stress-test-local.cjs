/**
 * Baan 7 Orientation Portal - Supabase & Vercel Safe Stress Tester
 * Simulates concurrent REST and Realtime traffic to measure latencies and check tier limits.
 * Run with: node stress-test-local.cjs [concurrency] [duration_seconds] [type]
 * Example:  node stress-test-local.cjs 20 10 all
 */

const fs = require('fs');
const http = require('https');
const { URL } = require('url');

// 1. Manually parse .env file to extract credentials without external dependencies
function loadEnv() {
  if (!fs.existsSync('.env')) {
    console.error('❌ Error: .env file not found in the current directory!');
    process.exit(1);
  }
  const content = fs.readFileSync('.env', 'utf-8');
  content.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let val = match[2] || '';
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      process.env[key] = val;
    }
  });
}

loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Error: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing in .env!');
  process.exit(1);
}

// 2. Parse arguments
const concurrency = parseInt(process.argv[2]) || 15;
const duration = parseInt(process.argv[3]) || 10;
const testType = process.argv[4] || 'all'; // 'all', 'rest', 'realtime'

// Safety check to prevent users from accidentally blacklisting their Supabase instance
if (concurrency > 100) {
  console.warn('⚠️ Warning: Concurrency capped at 100 to prevent IP blacklist or database CPU lockout.');
  console.warn('To override this, edit the script directly. Proceeding with concurrency = 100...');
}
const finalConcurrency = Math.min(concurrency, 100);

console.log('====================================================');
console.log('📊 Baan 7 Orientation Portal - Local Stress Test Tool');
console.log('====================================================');
console.log(`Supabase Host:  ${SUPABASE_URL}`);
console.log(`Concurrency:    ${finalConcurrency} simulated clients`);
console.log(`Duration:       ${duration} seconds`);
console.log(`Test Type:      ${testType.toUpperCase()}`);
console.log('====================================================\n');

// 3. Stats trackers
const stats = {
  rest: {
    attempts: 0,
    successes: 0,
    failures: 0,
    latencies: []
  },
  realtime: {
    attempts: 0,
    successes: 0,
    failures: 0,
    latencies: [],
    activeConnections: 0
  }
};

let testRunning = true;

// Helper to make HTTPS requests using native node https (no dependencies)
function makeRequest(urlStr, headers = {}) {
  return new Promise((resolve) => {
    const start = Date.now();
    const parsedUrl = new URL(urlStr);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        ...headers,
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        const latency = Date.now() - start;
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, latency, statusCode: res.statusCode });
        } else {
          resolve({ success: false, latency, error: `HTTP ${res.statusCode}: ${body.slice(0, 100)}` });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ success: false, latency: Date.now() - start, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, latency: Date.now() - start, error: 'TIMEOUT (5000ms)' });
    });

    req.end();
  });
}

// 4. REST Load Generator
async function runRestClient(clientId) {
  const url = `${SUPABASE_URL}/rest/v1/posts?select=*,author:users(student_id,nickname,avatar_color,role,profile_pic_url)&type=eq.hype&is_hidden=eq.false&order=is_pinned.desc,created_at.desc&limit=50`;
  
  while (testRunning) {
    stats.rest.attempts++;
    const res = await makeRequest(url);
    
    if (res.success) {
      stats.rest.successes++;
      stats.rest.latencies.push(res.latency);
    } else {
      stats.rest.failures++;
      console.error(`[REST Client ${clientId}] Failed: ${res.error}`);
    }
    
    // Add a small delay between requests to simulate realistic user click/scrolling behavior
    await new Promise(r => setTimeout(r, Math.random() * 500 + 100)); // 100-600ms stagger
  }
}

// 5. WebSocket Realtime Load Generator
// Note: Uses native global WebSocket available in Node 22/24
function runRealtimeClient(clientId) {
  if (!global.WebSocket) {
    console.error('❌ Error: WebSocket is not globally available. Please run on Node 22+ or install "ws".');
    process.exit(1);
  }

  const wsUrl = `${SUPABASE_URL.replace('https://', 'wss://')}/realtime/v1/websocket?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`;
  const start = Date.now();
  stats.realtime.attempts++;

  let ws;
  try {
    ws = new WebSocket(wsUrl);
  } catch (err) {
    stats.realtime.failures++;
    console.error(`[WS Client ${clientId}] Failed to instantiate: ${err.message}`);
    return;
  }

  let pingInterval;
  let hasConnected = false;

  ws.onopen = () => {
    stats.realtime.activeConnections++;
    stats.realtime.successes++;
    const connectTime = Date.now() - start;
    stats.realtime.latencies.push(connectTime);
    hasConnected = true;

    // Join the chat broadcast channel
    const joinPayload = {
      topic: `realtime:live_chat:hype`,
      event: 'phx_join',
      payload: {},
      ref: `ref_${clientId}_join`
    };
    ws.send(JSON.stringify(joinPayload));

    // Keep connection alive with Phoenix heartbeats every 25 seconds
    pingInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          topic: 'phoenix',
          event: 'heartbeat',
          payload: {},
          ref: `ref_${clientId}_heartbeat_${Date.now()}`
        }));
      }
    }, 25000);
  };

  ws.onmessage = (event) => {
    // Handle messages if needed, here we just listen
  };

  ws.onerror = (err) => {
    if (!hasConnected) {
      stats.realtime.failures++;
      console.error(`[WS Client ${clientId}] Connection error: ${err.message}`);
    }
  };

  ws.onclose = () => {
    if (hasConnected) {
      stats.realtime.activeConnections--;
    }
    clearInterval(pingInterval);
  };

  // Keep a reference to close when test ends
  return ws;
}

// 6. Test Orchestration
async function main() {
  const activeSockets = [];

  // Start load generators
  if (testType === 'all' || testType === 'rest') {
    for (let i = 0; i < finalConcurrency; i++) {
      runRestClient(i);
    }
  }

  if (testType === 'all' || testType === 'realtime') {
    for (let i = 0; i < finalConcurrency; i++) {
      const ws = runRealtimeClient(i);
      if (ws) activeSockets.push(ws);
      // Stagger socket connections slightly to prevent instant handshake throttling
      await new Promise(r => setTimeout(r, 80));
    }
  }

  // Monitor progress
  let secondsElapsed = 0;
  const progressInterval = setInterval(() => {
    secondsElapsed++;
    const restSuccess = stats.rest.successes;
    const wsActive = stats.realtime.activeConnections;
    console.log(`⏱️  Progress: ${secondsElapsed}/${duration}s | REST requests: ${restSuccess} | Active WebSockets: ${wsActive}/${finalConcurrency}`);
  }, 1000);

  // Wait for duration to end
  await new Promise(r => setTimeout(r, duration * 1000));
  
  // Stop load generators
  testRunning = false;
  clearInterval(progressInterval);
  console.log('\n🛑 Test duration reached. Cleaning up connections...');
  
  // Close WebSockets
  activeSockets.forEach(ws => {
    if (ws && ws.readyState === ws.OPEN) {
      ws.close();
    }
  });

  // Wait 1 second for sockets to close cleanly
  await new Promise(r => setTimeout(r, 1000));

  // 7. Calculate stats and report
  console.log('\n====================================================');
  console.log('📈 STRESS TEST RESULTS');
  console.log('====================================================');
  
  if (testType === 'all' || testType === 'rest') {
    const latencies = stats.rest.latencies.sort((a, b) => a - b);
    const count = latencies.length;
    const mean = count ? Math.round(latencies.reduce((a, b) => a + b, 0) / count) : 0;
    const min = count ? latencies[0] : 0;
    const max = count ? latencies[count - 1] : 0;
    const p95 = count ? latencies[Math.floor(count * 0.95)] : 0;
    const p99 = count ? latencies[Math.floor(count * 0.99)] : 0;

    console.log('--- Database REST Throughput (PostgREST) ---');
    console.log(`Total Requests:  ${stats.rest.attempts}`);
    console.log(`Successful:      ${stats.rest.successes} (${count ? Math.round(stats.rest.successes / stats.rest.attempts * 100) : 0}%)`);
    console.log(`Failed:          ${stats.rest.failures}`);
    console.log(`Latency (ms):    Avg: ${mean}ms | Min: ${min}ms | Max: ${max}ms | p95: ${p95}ms | p99: ${p99}ms`);
    console.log('');
  }

  if (testType === 'all' || testType === 'realtime') {
    const wsLatencies = stats.realtime.latencies.sort((a, b) => a - b);
    const count = wsLatencies.length;
    const mean = count ? Math.round(wsLatencies.reduce((a, b) => a + b, 0) / count) : 0;
    const min = count ? wsLatencies[0] : 0;
    const max = count ? wsLatencies[count - 1] : 0;

    console.log('--- Realtime WebSockets ---');
    console.log(`Connection Attempts: ${stats.realtime.attempts}`);
    console.log(`Successful:          ${stats.realtime.successes} (${stats.realtime.attempts ? Math.round(stats.realtime.successes / stats.realtime.attempts * 100) : 0}%)`);
    console.log(`Failed/Throttled:    ${stats.realtime.failures}`);
    console.log(`Handshake (ms):      Avg: ${mean}ms | Min: ${min}ms | Max: ${max}ms`);
    console.log('');
  }
  
  console.log('Test completed.');
  console.log('====================================================');
}

main().catch(console.error);
