import { buildPushPayload } from '@block65/webcrypto-web-push';

// Must be kept in sync by hand with js/daynav.js's BUILT_DAYS whenever a new day ships.
const BUILT_DAYS = [1, 2, 3, 4];

const ODIA_DIGITS = ['୦','୧','୨','୩','୪','୫','୬','୭','୮','୯'];
function toOdiaNumber(n){ return String(n).split('').map(c => ODIA_DIGITS[c] || c).join(''); }

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 204){
  return new Response(body == null ? null : JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function subKey(endpoint){
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return 'sub:' + [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function todayStr(){ return new Date().toISOString().slice(0, 10); }
function yesterdayStr(){ const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); }

async function handleSubscribe(request, env){
  const sub = await request.json();
  if(!sub || !sub.endpoint || !sub.keys) return json({ error: 'invalid subscription' }, 400);

  const key = await subKey(sub.endpoint);
  const existing = await env.SUBS.get(key, 'json');
  await env.SUBS.put(key, JSON.stringify({
    endpoint: sub.endpoint,
    keys: sub.keys,
    lastDay: existing?.lastDay || 0,
    lastVisit: existing?.lastVisit || null,
    streak: existing?.streak || 0,
  }));
  return json(null, 204);
}

async function handleProgress(request, env){
  const { endpoint, day } = await request.json();
  if(!endpoint || typeof day !== 'number') return json({ error: 'invalid body' }, 400);

  const key = await subKey(endpoint);
  const record = await env.SUBS.get(key, 'json');
  if(!record) return json({ error: 'not subscribed' }, 404);

  const today = todayStr();
  let { streak = 0, lastVisit = null } = record;
  if(lastVisit !== today){
    streak = (lastVisit === yesterdayStr()) ? streak + 1 : 1;
    lastVisit = today;
  }
  const lastDay = Math.max(record.lastDay || 0, day);

  await env.SUBS.put(key, JSON.stringify({ ...record, lastDay, lastVisit, streak }));
  return json(null, 204);
}

async function handleUnsubscribe(request, env){
  const { endpoint } = await request.json();
  if(!endpoint) return json({ error: 'invalid body' }, 400);
  await env.SUBS.delete(await subKey(endpoint));
  return json(null, 204);
}

async function sendPush(record, env){
  const nextDay = (record.lastDay || 0) + 1;
  if(!BUILT_DAYS.includes(nextDay)) return;

  const title = `ଦିନ ${toOdiaNumber(nextDay)} ଆପଣଙ୍କୁ ଅପେକ୍ଷା କରୁଛି! 🔥`;
  const body = `ଆପଣଙ୍କ streak: ${toOdiaNumber(record.streak || 0)} ଦିନ — ଆଜିର challenge ସମ୍ପୂର୍ଣ୍ଣ କରନ୍ତୁ।`;

  const message = {
    data: JSON.stringify({ title, body }),
    options: { ttl: 60 * 60 * 24, urgency: 'normal' },
  };
  const subscription = { endpoint: record.endpoint, expirationTime: null, keys: record.keys };
  const vapid = { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };

  const req = await buildPushPayload(message, subscription, vapid);
  return fetch(record.endpoint, req);
}

export default {
  async fetch(request, env){
    if(request.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

    const { pathname } = new URL(request.url);
    if(request.method === 'POST' && pathname === '/subscribe') return handleSubscribe(request, env);
    if(request.method === 'POST' && pathname === '/progress') return handleProgress(request, env);
    if(request.method === 'POST' && pathname === '/unsubscribe') return handleUnsubscribe(request, env);
    return json({ error: 'not found' }, 404);
  },

  async scheduled(event, env, ctx){
    let cursor;
    do {
      const page = await env.SUBS.list({ cursor, limit: 1000 });
      cursor = page.list_complete ? undefined : page.cursor;

      await Promise.all(page.keys.map(async ({ name }) => {
        const record = await env.SUBS.get(name, 'json');
        if(!record) return;
        try{
          const res = await sendPush(record, env);
          if(res && (res.status === 404 || res.status === 410)) await env.SUBS.delete(name);
        }catch(err){
          console.error('push failed', name, err);
        }
      }));
    } while(cursor);
  },
};
