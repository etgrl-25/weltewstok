const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

const encoder = new TextEncoder();
const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
const fromB64url = value => { const b=value.replace(/-/g,"+").replace(/_/g,"/"); return Uint8Array.from(atob(b.padEnd(Math.ceil(b.length/4)*4,"=")),c=>c.charCodeAt(0)); };
function cookie(request) { return (request.headers.get("Cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("weltewstok_session="))?.slice("weltewstok_session=".length); }
function authorized(request) { return Boolean(cookie(request)); }
async function login(request, env) {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const body = await request.json();
    const email = String(body.email||"").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Geçerli bir e-posta adresi yazın" }, { status: 400, headers });
    const token = b64url(encoder.encode(email));
    return Response.json({ ok: true }, { headers: { ...headers, "set-cookie": `weltewstok_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000` } });
  } catch { return Response.json({ error: "Giriş bilgisi okunamadı" }, { status: 400, headers }); }
}
const loginPage = `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#123c36"><title>Weltew Stok · Giriş</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f7f4;font:16px system-ui;color:#172a26"><form id="loginForm" style="width:min(360px,calc(100% - 40px));padding:30px;background:#fff;border:1px solid #e6ebe7;border-radius:18px;box-shadow:0 18px 60px #123c3615"><div style="width:42px;height:42px;display:grid;place-items:center;border-radius:12px;background:#123c36;color:white;font-size:21px;font-weight:bold">W</div><h1 style="font-size:23px;margin:18px 0 6px">Weltew Stok</h1><p style="color:#71817b;margin:0 0 22px">E-posta adresinizi yazıp devam edin.</p><label for="email" style="font-size:13px;font-weight:700">E-posta</label><input id="email" type="email" required autocomplete="email" autofocus placeholder="ornek@email.com" style="width:100%;box-sizing:border-box;height:46px;margin:8px 0 14px;padding:0 12px;border:1px solid #dfe7e1;border-radius:9px;font:inherit"><button style="width:100%;height:45px;border:0;border-radius:9px;background:#123c36;color:#fff;font:700 14px system-ui;cursor:pointer">Giriş yap</button><p id="error" role="status" style="color:#b85541;font-size:13px;min-height:18px"></p></form><script>const form=document.querySelector('#loginForm'),input=document.querySelector('#email'),status=document.querySelector('#error');form.addEventListener('submit',async event=>{event.preventDefault();const button=form.querySelector('button');button.disabled=true;status.textContent='';try{const response=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:input.value})});const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||'Giriş başarısız');location.reload()}catch(error){status.textContent=error.message;button.disabled=false}});</script></body></html>`;

const schema = `CREATE TABLE IF NOT EXISTS products (
 id TEXT PRIMARY KEY, sku TEXT NOT NULL UNIQUE, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT '',
 qty REAL NOT NULL DEFAULT 0, unit TEXT NOT NULL DEFAULT 'adet', buy REAL NOT NULL DEFAULT 0,
 sell REAL NOT NULL DEFAULT 0, min REAL NOT NULL DEFAULT 0, branch TEXT, warehouse TEXT, barcode TEXT,
 group1 TEXT, product_group TEXT, family TEXT, vat_percent REAL, last_purchase_price REAL,
 last_purchase_cost REAL, moving_cost REAL, cost_amount REAL, vat_included_amount REAL, unit_price_vat_included REAL
);
CREATE TABLE IF NOT EXISTS movements (
 id TEXT PRIMARY KEY, product_id TEXT NOT NULL, product_name TEXT NOT NULL, type TEXT NOT NULL,
 qty REAL NOT NULL, before_qty REAL NOT NULL, after_qty REAL NOT NULL, note TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`;

const toProduct = r => ({ id: r.id, sku: r.sku, name: r.name, category: r.category, qty: r.qty, unit: r.unit,
  buy: r.buy, sell: r.sell, min: r.min, branch: r.branch, warehouse: r.warehouse, barcode: r.barcode,
  group1: r.group1, productGroup: r.product_group, family: r.family, vatPercent: r.vat_percent,
  lastPurchasePrice: r.last_purchase_price, lastPurchaseCost: r.last_purchase_cost, movingCost: r.moving_cost,
  costAmount: r.cost_amount, vatIncludedAmount: r.vat_included_amount, unitPriceVatIncluded: r.unit_price_vat_included });

async function api(request, env, url) {
    if (!authorized(request)) return Response.json({ error: "Giriş gerekli" }, { status: 401, headers });
  if (!env.DB) return Response.json({ error: "Veritabanı bağlantısı henüz yapılmadı" }, { status: 503, headers });
  await env.DB.exec(schema);
  const path = url.pathname;
  if (path === "/api/products" && request.method === "GET") {
    const imported = await env.DB.prepare("SELECT value FROM app_meta WHERE key='inventory_import_done'").first();
    if (!imported && env.ASSETS) {
      const seedResponse = await env.ASSETS.fetch(new Request(new URL("/stok-weltew-urunler.json", url.origin)));
      if (seedResponse.ok) {
        const rows = await seedResponse.json();
        const statements = rows.filter(p => p.productName && p.productCode).map(p => env.DB.prepare(`INSERT OR IGNORE INTO products (id,sku,name,category,qty,unit,buy,sell,min,branch,warehouse,barcode,group1,product_group,family,vat_percent,last_purchase_price,last_purchase_cost,moving_cost,cost_amount,vat_included_amount,unit_price_vat_included) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .bind(crypto.randomUUID(),String(p.productCode).trim(),String(p.productName).trim(),p.family||p.productGroup||p.group1||"",Number(p.quantity)||0,"adet",Number(p.lastPurchaseCost)||0,0,0,p.branch||null,p.warehouse||null,p.barcode||null,p.group1||null,p.productGroup||null,p.family||null,Number(p.vatPercent)||0,Number(p.lastPurchasePrice)||0,Number(p.lastPurchaseCost)||0,Number(p.movingCost)||0,Number(p.costAmount)||0,Number(p.vatIncludedAmount)||0,Number(p.unitPriceVatIncluded)||0));
        for (let i=0;i<statements.length;i+=40) await env.DB.batch(statements.slice(i,i+40));
        await env.DB.prepare("INSERT OR REPLACE INTO app_meta(key,value) VALUES('inventory_import_done','yes')").run();
      }
    }
    const { results } = await env.DB.prepare("SELECT * FROM products ORDER BY name COLLATE NOCASE").all();
    return Response.json(results.map(toProduct), { headers });
  }
  if (path === "/api/products" && request.method === "POST") {
    const p = await request.json();
    if (!p.name?.trim() || !p.sku?.trim()) return Response.json({ error: "Ürün adı ve kodu gerekli" }, { status: 400, headers });
    const id = p.id || crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO products (id,sku,name,category,qty,unit,buy,sell,min,branch,warehouse,barcode,group1,product_group,family,vat_percent,last_purchase_price,last_purchase_cost,moving_cost,cost_amount,vat_included_amount,unit_price_vat_included)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET sku=excluded.sku,name=excluded.name,category=excluded.category,qty=excluded.qty,unit=excluded.unit,buy=excluded.buy,sell=excluded.sell,min=excluded.min,branch=excluded.branch,warehouse=excluded.warehouse,barcode=excluded.barcode,group1=excluded.group1,product_group=excluded.product_group,family=excluded.family,vat_percent=excluded.vat_percent,last_purchase_price=excluded.last_purchase_price,last_purchase_cost=excluded.last_purchase_cost,moving_cost=excluded.moving_cost,cost_amount=excluded.cost_amount,vat_included_amount=excluded.vat_included_amount,unit_price_vat_included=excluded.unit_price_vat_included`)
      .bind(id,p.sku.trim(),p.name.trim(),p.category||"",Number(p.qty)||0,p.unit||"adet",Number(p.buy)||0,Number(p.sell)||0,Number(p.min)||0,p.branch||null,p.warehouse||null,p.barcode||null,p.group1||null,p.productGroup||null,p.family||null,Number(p.vatPercent)||0,Number(p.lastPurchasePrice)||0,Number(p.lastPurchaseCost)||0,Number(p.movingCost)||0,Number(p.costAmount)||0,Number(p.vatIncludedAmount)||0,Number(p.unitPriceVatIncluded)||0).run();
    return Response.json({ id }, { status: 201, headers });
  }
  if (path.startsWith("/api/products/") && request.method === "DELETE") {
    const id = decodeURIComponent(path.split("/").pop());
    await env.DB.batch([env.DB.prepare("DELETE FROM movements WHERE product_id=?").bind(id), env.DB.prepare("DELETE FROM products WHERE id=?").bind(id)]);
    return Response.json({ ok: true }, { headers });
  }
  if (path === "/api/import" && request.method === "POST") {
    const rows = await request.json();
    if (!Array.isArray(rows) || rows.length > 3000) return Response.json({ error: "En çok 3.000 ürün aktarılabilir" }, { status: 400, headers });
    const statements = rows.filter(p => p.productName && p.productCode).map(p => env.DB.prepare(`INSERT INTO products (id,sku,name,category,qty,unit,buy,sell,min,branch,warehouse,barcode,group1,product_group,family,vat_percent,last_purchase_price,last_purchase_cost,moving_cost,cost_amount,vat_included_amount,unit_price_vat_included)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(sku) DO UPDATE SET name=excluded.name,category=excluded.category,qty=excluded.qty,unit=excluded.unit,buy=excluded.buy,branch=excluded.branch,warehouse=excluded.warehouse,barcode=excluded.barcode,group1=excluded.group1,product_group=excluded.product_group,family=excluded.family,vat_percent=excluded.vat_percent,last_purchase_price=excluded.last_purchase_price,last_purchase_cost=excluded.last_purchase_cost,moving_cost=excluded.moving_cost,cost_amount=excluded.cost_amount,vat_included_amount=excluded.vat_included_amount,unit_price_vat_included=excluded.unit_price_vat_included`)
      .bind(crypto.randomUUID(),String(p.productCode).trim(),String(p.productName).trim(),p.family||p.productGroup||p.group1||"",Number(p.quantity)||0,"adet",Number(p.lastPurchaseCost)||0,0,0,p.branch||null,p.warehouse||null,p.barcode||null,p.group1||null,p.productGroup||null,p.family||null,Number(p.vatPercent)||0,Number(p.lastPurchasePrice)||0,Number(p.lastPurchaseCost)||0,Number(p.movingCost)||0,Number(p.costAmount)||0,Number(p.vatIncludedAmount)||0,Number(p.unitPriceVatIncluded)||0));
    let count = 0;
    for (let i=0;i<statements.length;i+=40) { await env.DB.batch(statements.slice(i,i+40)); count += statements.slice(i,i+40).length; }
    await env.DB.prepare("INSERT OR REPLACE INTO app_meta(key,value) VALUES('inventory_import_done','yes')").run();
    return Response.json({ imported: count }, { headers });
  }
  if (path === "/api/movements" && request.method === "GET") {
    const { results } = await env.DB.prepare("SELECT * FROM movements ORDER BY created_at DESC LIMIT 300").all();
    return Response.json(results, { headers });
  }
  if (path === "/api/movements" && request.method === "POST") {
    const m = await request.json();
    const p = await env.DB.prepare("SELECT * FROM products WHERE id=?").bind(m.productId).first();
    if (!p) return Response.json({ error: "Ürün bulunamadı" }, { status: 404, headers });
    const amount = Number(m.qty)||0; const after = m.type === "duzeltme" ? amount : p.qty + (m.type === "cikis" ? -amount : amount);
    if (after < 0) return Response.json({ error: "Stok eksiye düşemez" }, { status: 400, headers });
    const id = crypto.randomUUID();
    await env.DB.batch([env.DB.prepare("UPDATE products SET qty=? WHERE id=?").bind(after,p.id),env.DB.prepare("INSERT INTO movements(id,product_id,product_name,type,qty,before_qty,after_qty,note) VALUES(?,?,?,?,?,?,?,?)").bind(id,p.id,p.name,m.type,m.type==="cikis"?-amount:amount,p.qty,after,m.note||"")]);
    return Response.json({ id, before: p.qty, after }, { headers });
  }
  return Response.json({ error: "Bulunamadı" }, { status: 404, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/login") return login(request, env);
    if (url.pathname === "/api/logout" && request.method === "POST") return new Response(null,{status:204,headers:{"set-cookie":"weltewstok_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0","cache-control":"no-store"}});
    if (!authorized(request)) {
      if (url.pathname.startsWith("/api/")) return Response.json({ error: "Giriş yapmanız gerekiyor" }, { status: 401, headers });
      return new Response(loginPage,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});
    }
    if (url.pathname.startsWith("/api/")) return api(request, env, url);
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("StokTakip dosyaları eksik", { status: 503 });
  }
};
