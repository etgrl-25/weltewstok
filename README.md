# Weltew Stok Yönetimi

Cloudflare Workers + D1 ile çalışan, Türkçe ve mobil uyumlu stok yönetimi. Giriş ekranında e-posta adresi yazılır; e-posta doğrulaması yapılmaz.

## İçerik

- `worker.js`: Cloudflare Worker API, D1 ürün ve stok hareketi kayıtları, e-posta ile basit oturum.
- `index.html`, `app.js`, `style.css`, `manifest.json`: uygulama arayüzü.
- `stok-weltew-urunler.json`: ilk stok aktarım dosyası.
- `wrangler.toml`: Worker, statik dosya ve D1 bağlantı tanımı.

Giriş için herhangi bir geçerli e-posta adresi yazılabilir; doğrulama veya parola istenmez. Uygulamaya erişimi olan herkes stok kayıtlarını görebilir ve değiştirebilir. İlk açılışta ürün listesi D1'e bir kez aktarılır. Sonraki değişiklikler D1'de saklanır; masaüstü ve telefonlarda aynı kayıtlar görünür.

## Cloudflare ayarları

1. Cloudflare Worker'a D1'de oluşturulan veritabanını `DB` adıyla bağlayın.
2. `ASSETS` varlık bağlamasını kök dizine bağlayın ve isteklerin önce Worker kodundan geçtiğini doğrulayın.
3. GitHub `main` dalı dağıtıldığında Worker yeniden yayınlanır. Veritabanı tabloları uygulamanın ilk isteğinde hazırlanır.

Ürün aktarımı ilk açılışta `stok-weltew-urunler.json` üzerinden yapılır. Uygulama içinde daha sonra JSON dosyasından yeniden içe aktarma düğmesi de bulunur. Dosyadaki boş barkodlar boş kalır; Excel'deki stok miktarı, ürün kodu, ürün adı, depo, aile/grup ve maliyet alanları korunur.

## Toplu stok sıfırlama

Cloudflare Worker gizli ayarlarına STOCK_RESET_PASSWORD ekleyin. Şifre sunucuda doğrulanır; ayar yoksa sıfırlama engellenir. Buton tüm ürün miktarlarını sıfırlar, ürünleri korur ve stok hareketi kaydeder.
