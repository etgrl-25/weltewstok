const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

async function authorized(request, env) {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token || !env.ACCESS_ISSUER || !env.ACCESS_AUD) return false;
  try {
    const [h, p, sig] = token.split(".");
    const head = JSON.parse(atob(h.replace(/-/g, "+").replace(/_/g, "/")));
    const payload = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.iss !== env.ACCESS_ISSUER || ![].concat(payload.aud || []).includes(env.ACCESS_AUD) || payload.exp * 1000 < Date.now()) return false;
    const certs = await fetch(`${env.ACCESS_ISSUER}/cdn-cgi/access/certs`).then(r => r.json());
    const jwk = certs.keys.find(k => k.kid === head.kid);
    if (!jwk) return false;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const bytes = Uint8Array.from(atob(sig.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
    return await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, bytes, new TextEncoder().encode(`${h}.${p}`));
  } catch { return false; }
}

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
  if (!(await authorized(request, env))) return Response.json({ error: "Giriş gerekli" }, { status: 401, headers });
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
    if (!(await authorized(request, env))) return new Response("Bu uygulama için Cloudflare Access girişi gerekiyor.", { status: 401, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
    if (url.pathname.startsWith("/api/")) return api(request, env, url);
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("StokTakip dosyaları eksik", { status: 503 });
  }
};
