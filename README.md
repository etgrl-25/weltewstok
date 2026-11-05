# Weltew Stok Yönetimi

Cloudflare Workers + D1 ile çalışan, Türkçe ve mobil uyumlu stok yönetimi. Uygulamaya özel parola girişi kullanır; Zero Trust etkinleştirmek veya kart eklemek gerekmez.

## İçerik

- `worker.js`: Cloudflare Worker API, D1 ürün ve stok hareketi kayıtları, Cloudflare Access JWT doğrulaması.
- `index.html`, `app.js`, `style.css`, `manifest.json`: uygulama arayüzü.
- `stok-weltew-urunler.json`: ilk stok aktarım dosyası.
- `wrangler.toml`: Worker, statik dosya ve D1 bağlantı tanımı.

`APP_PASSWORD` adlı Worker gizli ayarına güçlü ve en az 16 karakterli bir parola eklenmeden uygulama oturumu açılmaz. Parola kaynak koduna ya da GitHub'a yazılmaz. Başarılı giriş sekiz saatlik güvenli oturum açar. İlk yetkili açılışta ürün listesi D1'e bir kez aktarılır. Sonraki değişiklikler D1'de saklanır; masaüstü ve telefonlarda aynı kayıtlar görünür.

## Cloudflare ayarları

1. Cloudflare Worker'a D1'de oluşturulan veritabanını `DB` adıyla bağlayın.
2. `ASSETS` varlık bağlamasını kök dizine bağlayın ve isteklerin önce Worker kodundan geçtiğini doğrulayın.
3. Worker > Settings > Variables and Secrets > Add > Secret bölümünde `APP_PASSWORD` adıyla güçlü bir parola ekleyin. Parolayı GitHub'a veya sohbet mesajına yazmayın.
4. Değişikliği Deploy edin. GitHub `main` dalı dağıtıldığında Worker yeniden yayınlanır. Veritabanı tabloları uygulamanın ilk isteğinde hazırlanır.

Ürün aktarımı ilk açılışta `stok-weltew-urunler.json` üzerinden yapılır. Uygulama içinde daha sonra JSON dosyasından yeniden içe aktarma düğmesi de bulunur. Dosyadaki boş barkodlar boş kalır; Excel'deki stok miktarı, ürün kodu, ürün adı, depo, aile/grup ve maliyet alanları korunur.
