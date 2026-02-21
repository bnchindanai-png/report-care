const https = require('https');

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxHY8wqA9JSN7GJx5F31IpkYOIJn0bZEsg_bFrlWLvkTrX-diCI7DD7qOG1KfU4AQW2-A/exec?sheetId=1TLuQMZUvdXR-5CH_jTJ3GHMqXchmlkkAc7yg5ZLG2dU&action=read';

const SUPABASE_URL = 'https://ikfioqvjrhquiyeylmsv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZmlvcXZqcmhxdWl5ZXlsbXN2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDgzNDcxNywiZXhwIjoyMDY2NDEwNzE3fQ.iaOMfUDY_FUfnRsjlGSkRNxi4mJj3hYbwvFUmXYfyMI';

function fetchUrl(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));
    const lib = url.startsWith('https') ? https : require('http');
    lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      // Force UTF-8 encoding
      res.setEncoding('utf8');
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        console.log(`   Redirect ${res.statusCode} -> following...`);
        return fetchUrl(res.headers.location, maxRedirects - 1).then(resolve).catch(reject);
      }
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('JSON parse error: ' + body.substring(0, 200))); }
      });
    }).on('error', reject);
  });
}

function supabasePost(path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SUPABASE_URL);
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: url.hostname, path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(data, 'utf8'),
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal',
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: d }));
    });
    req.on('error', reject);
    req.write(data, 'utf8');
    req.end();
  });
}

// Clean string: remove Unicode replacement characters
function clean(str) {
  if (!str) return str;
  return str.replace(/\uFFFD/g, '');
}

function supabaseGet(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SUPABASE_URL);
    https.get({
      hostname: url.hostname, path: url.pathname + url.search,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      }
    }, (res) => {
      res.setEncoding('utf8');
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch { resolve([]); }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('=== Incremental Sync: Google Sheets -> Supabase ===\n');

  console.log('1. Fetching Google Sheets data...');
  const result = await fetchUrl(GAS_URL);
  const allRecords = result.data || [];
  console.log(`   Found ${allRecords.length} records in Sheets\n`);

  console.log('2. Checking existing records in DB...');
  const existing = await supabaseGet('/rest/v1/news_re_duty_reports?select=id');
  const existingIds = new Set(Array.isArray(existing) ? existing.map(r => r.id) : []);
  console.log(`   Found ${existingIds.size} existing records in DB\n`);

  const records = allRecords.filter(r => !existingIds.has(r.id));
  if (records.length === 0) {
    console.log('   No new records to sync. Already up to date!');
    return;
  }
  console.log(`   ${records.length} new records to sync\n`);

  // Insert into news_re_duty_reports
  console.log('3. Inserting into news_re_duty_reports...');
  let ok1 = 0, fail1 = 0;
  for (const r of records) {
    const res = await supabasePost('/rest/v1/news_re_duty_reports', {
      id: r.id,
      report_date: r.reportDate || null,
      duty_time: clean(r.dutyTime) || null,
      staff_name: clean(r.staffName) || null,
      position: clean(r.position) || null,
      location: clean(r.location) || null,
      activity: clean(r.activity) || null,
      event_detail: clean(r.eventDetail) || null,
      note: clean(r.note) || null,
      image_url: r.imageUrl || null,
      acknowledged: r.acknowledged === true || r.acknowledged === 'true',
    });
    if (res.status === 201) { ok1++; process.stdout.write('.'); }
    else { fail1++; process.stdout.write(`[${res.status}]`); }
  }
  console.log(`\n   OK: ${ok1}, Failed: ${fail1}\n`);

  // Insert into feed_posts
  console.log('4. Inserting into feed_posts...');
  let ok2 = 0, fail2 = 0;
  for (const r of records) {
    const eventDetail = clean(r.eventDetail) || '';
    const note = clean(r.note) || '';
    const activity = clean(r.activity) || '-';

    const descParts = [];
    if (eventDetail) descParts.push(eventDetail);
    if (note) descParts.push('หมายเหตุ: ' + note);
    const description = descParts.length > 0 ? descParts.join('\n') : activity;

    const tags = [];
    if (r.reportDate) tags.push('report_date:' + r.reportDate);
    if (r.dutyTime) tags.push('duty_time:' + clean(r.dutyTime));

    let images = [];
    if (r.imageUrl) {
      try { images = JSON.parse(r.imageUrl); if (!Array.isArray(images)) images = [r.imageUrl]; }
      catch { images = [r.imageUrl]; }
    }

    const res = await supabasePost('/rest/v1/feed_posts', {
      title: activity,
      description,
      category: 'รายงานหน้าที่',
      tags,
      author_name: clean(r.staffName) || null,
      author_position: clean(r.position) || null,
      images,
      location: r.location ? { name: clean(r.location) } : null,
      acknowledged_at: (r.acknowledged === true || r.acknowledged === 'true')
        ? (r.timestamp || new Date().toISOString()) : null,
      created_at: r.timestamp || new Date().toISOString(),
    });
    if (res.status === 201) { ok2++; process.stdout.write('.'); }
    else { fail2++; process.stdout.write(`[${res.status}]`); }
  }
  console.log(`\n   OK: ${ok2}, Failed: ${fail2}\n`);

  console.log(`Done! Total synced: ${ok2} records into feed_posts`);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
