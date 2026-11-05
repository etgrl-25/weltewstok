# Weltew Stok Yönetimi

Cloudflare Workers + D1 ile çalışan, Türkçe ve mobil uyumlu stok yönetimi.

## İçerik

- `worker.js`: Cloudflare Worker API, D1 ürün ve stok hareketi kayıtları, Cloudflare Access JWT doğrulaması.
- `index.html`, `app.js`, `style.css`, `manifest.json`: uygulama arayüzü.
- `stok-weltew-urunler.json`: ilk stok aktarım dosyası.
- `wrangler.toml`: Worker, statik dosya ve D1 bağlantı tanımı.

İlk girişte `ACCESS_ISSUER` ve `ACCESS_AUD` değişkenleri ile D1 bağlantısı tanımlı değilse uygulama güvenlik gereği 401/503 döndürür. Access koruması açılmadan uygulama veriye erişim sağlamaz. İlk yetkili açılışta ürün listesi D1'e bir kez aktarılır. Sonraki değişiklikler D1'de saklanır; masaüstü ve telefonlarda aynı kayıtlar görünür.

## Cloudflare ayarları

1. Cloudflare Worker'a D1'de oluşturulan veritabanını `DB` adıyla bağlayın.
2. `ASSETS` varlık bağlamasını kök dizine bağlayın ve isteklerin önce Worker kodundan geçtiğini doğrulayın.
3. Cloudflare Access'te uygulama için giriş kuralını oluşturun; sadece kendi e-posta adresinize izin verin.
4. Worker değişkenlerine Access'in takım adresini `ACCESS_ISSUER` ve uygulama Audience değerini `ACCESS_AUD` olarak ekleyin.
5. GitHub `main` dalı dağıtıldığında Worker yayınlanır. Veritabanı tabloları uygulamanın ilk isteğinde hazırlanır.

Ürün aktarımı ilk açılışta `stok-weltew-urunler.json` üzerinden yapılır. Uygulama içinde daha sonra JSON dosyasından yeniden içe aktarma düğmesi de bulunur. Dosyadaki boş barkodlar boş kalır; Excel'deki stok miktarı, ürün kodu, ürün adı, depo, aile/grup ve maliyet alanları korunur.
