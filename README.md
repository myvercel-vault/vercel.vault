# MyVercel Vault

Password manager dengan tema hitam putih, logo asal yang dibekalkan pemilik, wallpaper bergerak pada skrin telefon, dan susun atur item mengikut kategori. Projek bebas; tidak bergabung dengan mana-mana perkhidmatan reka bentuk atau hosting yang dirujuk.

## Pilih tempat deploy

| Tempat | Apa yang dijalankan |
| --- | --- |
| Repositori GitHub | Kod sumber, aset, konfigurasi, ujian dan workflow. Jangan masukkan data peti simpanan atau secrets. |
| GitHub Pages (pilihan) | Halaman pengenalan, panduan dan demo interaktif. Tiada borang log masuk/daftar sebenar atau panggilan ke API vault. Jika URL Worker ditetapkan, butang akaun membuka laman Cloudflare. |
| Cloudflare Worker + D1 | Laman lengkap, pendaftaran, log masuk dan API di origin HTTPS yang sama. D1 menyimpan akaun, sesi dan peti simpanan yang sudah disulitkan dalam pelayar. |
| Ruby + SQLite | Pilihan menjalankan projek di komputer sendiri. Worker menggunakan JavaScript, bukan runtime Ruby. WebAssembly berjalan dalam pelayar untuk penjana kata laluan. |

GitHub Pages mengehadkan penggunaan untuk transaksi sensitif seperti menghantar kata laluan atau nombor kad. Oleh itu laman Pages dalam projek ini hanya untuk demo. Laman Cloudflare ialah alamat yang dibuka untuk menggunakan akaun sebenar.

## Fail yang diperlukan

| Laluan | Kegunaan |
| --- | --- |
| `src/views/`, `src/components/`, `src/main.js` | Halaman Vue 3, penghalaan, UI log masuk, pengurusan dan carian item. |
| `src/crypto.js`, `src/vault.js`, `src/items.js` | Penyulitan tempatan, sesi API dan skema item. |
| `public/media/` | Logo yang dipotong daripada imej pengguna, ilustrasi dan binari WASM yang sudah dibina. |
| `wasm/password.wat`, `src/password.js` | Kod WebAssembly dan integrasi penjana kata laluan. |
| `worker/index.js` | API Cloudflare Worker termasuk pendaftaran, log masuk, kemas kini dan pemadaman. |
| `worker/migrations/0001_vault.sql` | Jadual D1. |
| `wrangler.toml`, `public/_headers` | Konfigurasi Worker, D1, aset SPA, pembersihan sesi dan pengepala keselamatan. |
| `.github/workflows/pages.yml` | Build dan publikasi demo ke GitHub Pages. |
| `.github/workflows/cloudflare.yml` | Deploy Worker dari GitHub secara manual (pilihan). |
| `server/app.rb`, `Gemfile` | Server Ruby dan pangkalan data SQLite tempatan. |
| `package.json`, `package-lock.json`, `vite.config.js`, `index.html` | Versi dependensi serta konfigurasi Vue + Vite. |
| `tests/`, `scripts/check-api.mjs` | Ujian teras dan ujian API hujung ke hujung tempatan. |

## 1. Deploy Cloudflare Worker + D1

Prasyarat: Node.js **22.12+**, npm dan akaun Cloudflare. Jalankan arahan di folder projek:

```sh
npm ci
npx wrangler login
npx wrangler d1 create my-vercel-vault-db
```

Jika Wrangler menawarkan mengubah konfigurasi secara automatik, pilih **No**. Salin `database_id` (UUID) yang dipaparkan, dan gantikan UUID contoh dalam `wrangler.toml`. Kekalkan `binding = "DB"`. Ubah `name` Worker jika nama itu sudah digunakan di akaun anda. Jika anda mahu paparkan alamat syarikat sendiri, salin `.env.example` ke `.env.local` dan tetapkan `VITE_COMPANY_ADDRESS` sebelum build. Jangan tetapkan `VITE_HOSTING=pages` untuk build ini.

```sh
npx wrangler d1 migrations apply my-vercel-vault-db --remote
npm run build
npx wrangler deploy
```

Simpan **sekali sahaja** pepper rawak yang stabil di pengurus secrets yang anda percayai. Anda boleh menjana nilainya dengan `openssl rand -hex 32`. Masukkannya apabila Wrangler meminta:

```sh
npx wrangler secret put VAULT_PEPPER
```

Jangan letakkan pepper dalam repo, `wrangler.toml`, kod Vue, pemboleh ubah `VITE_*`, atau kongsi dengan pihak lain. Menukar/kehilangan pepper tanpa migrasi akan memutuskan pengesahan akaun sedia ada. Sebelum secret diset, API sengaja mengembalikan 503. Buka URL `https://<worker>.<subdomain>.workers.dev` yang dicetak oleh Wrangler, kemudian uji `/api/health`, daftar akaun ujian, simpan nota ujian, kunci, dan log masuk semula. Tiada CORS silang origin diperlukan. Jika mahu gunakan domain syarikat, tetapkan Custom Domain dari dashboard Worker dan gunakan origin baharu sebagai `VAULT_URL` pada langkah seterusnya.

`REGISTRATION_OPEN = "true"` membenarkan pengguna baharu mendaftar. Untuk vault persendirian, cipta akaun anda dahulu, ubah tetapan kepada `"false"`, kemudian deploy semula. Pendaftaran ini tidak mengesahkan pemilikan emel. Jangan umumkan versi ini untuk data sensitif sebelum penilaian keselamatan dan penyediaan kawalan pendaftaran, pemantauan, dasar retensi serta pemulihan.

## 2. Simpan di GitHub dan terbitkan demo GitHub Pages (pilihan)

1. Ekstrak arkib. Push kandungan folder projek ke repositori GitHub anda, termasuk `.github/workflows/pages.yml`, di branch `main`. Untuk repositori kosong, gunakan arahan Git di bawah. Jangan commit `node_modules/`, `dist/`, `.dev.vars`, `.env.local` atau folder data tempatan.
2. Di **Settings → Pages**, pilih **GitHub Actions** sebagai sumber.
3. Di **Settings → Secrets and variables → Actions → Variables**, tambah `VAULT_URL` dengan origin HTTPS Worker, contoh `https://my-vercel-vault.example.workers.dev` (tanpa laluan). Tambah `COMPANY_ADDRESS` jika mahu alamat syarikat dipaparkan. Kedua-duanya bukan secrets. Jika tiada `VAULT_URL`, pautan akaun digantikan dengan pautan panduan.
4. Di tab **Actions**, jalankan workflow **Deploy public demo to GitHub Pages** atau push perubahan ke `main`. Artikel seperti `/guide` boleh dibuka melalui pautan hash Pages; workflow membina `base` yang sesuai untuk nama repo.

Contoh push pertama (gantikan `NAMA_AKAUN/NAMA_REPO`):

```sh
git init -b main
git add .
git status --short
git commit -m "Add My Vercel Vault"
git remote add origin https://github.com/NAMA_AKAUN/NAMA_REPO.git
git push -u origin main
```

### Deploy semula Worker melalui GitHub Actions (pilihan)

Selepas deploy pertama dan set `VAULT_PEPPER` di Cloudflare, commit `wrangler.toml` dengan ID D1 sebenar. Di GitHub, tambah `CLOUDFLARE_ACCOUNT_ID` sebagai **variable** dan `CLOUDFLARE_API_TOKEN` sebagai **secret**. Hadkan token kepada akaun sasaran dengan kebenaran mengurus Workers Scripts dan D1. Jalankan **Deploy the vault to Cloudflare** daripada tab Actions. Workflow menguji kod, membina fail frontend, menjalankan migrasi D1, dan deploy Worker. Pepper kekal sebagai Cloudflare Worker secret dan tidak perlu disalin ke GitHub.

## Jalankan di komputer sendiri

**Cloudflare dev** (D1 dalam mesin sendiri; tidak menyentuh pangkalan data remote):

```sh
npm ci
npm run build
cp .dev.vars.example .dev.vars
# Edit .dev.vars dan masukkan pepper rawak khas untuk pembangunan.
npx wrangler d1 migrations apply my-vercel-vault-db --local
npx wrangler dev --local --port 8080
# Dari terminal kedua:
node scripts/check-api.mjs http://localhost:8080
```

**Ruby + SQLite** (Ruby 3.1+ dan Bundler). Pada Debian/Ubuntu, jika gem SQLite perlu dibina, sediakan `ruby-dev`, `build-essential` dan `libsqlite3-dev`. Pada sistem tanpa arahan `bundle`, gunakan nama yang dibekalkan oleh pakej OS (contohnya `bundle3.1`).

Langkah menjalankan:

```sh
npm ci
npm run build
bundle install
bundle exec ruby server/app.rb
# Buka http://localhost:3000
# Dari terminal kedua:
node scripts/check-api.mjs http://localhost:3000
```

Ruby menjalankan API setempat dan menghidangkan frontend yang telah dibina. `server/data/` menyimpan SQLite dan local pepper; jangan padam pepper jika masih perlu log masuk. Untuk pengubahan Vue secara langsung, set `API_ONLY=true PORT=9292` semasa memulakan Ruby dan jalankan `npm run dev` dalam terminal lain. Vite memproksi `/api` ke port 9292. Gunakan `localhost` ketika menguji Web Crypto dan pastikan baris konfigurasi proksi kekal. Untuk bina semula modul WASM selepas mengubah `.wat`, pasang WABT (`wat2wasm`), kemudian jalankan `npm run build:wasm`.

## Ciri dan had keselamatan

- Jenis item: login, kad, nota selamat, identiti dan kunci SSH. Setiap borang mempunyai `Create` dan boleh ditambah `Custom field` (teks atau tersembunyi).
- Carian nama dan maklumat terpilih, folder, favourites, arkib, tong sampah, mod grid/senarai, laporan kata laluan asas dan auto-lock.
- `Send` menghasilkan **fail** item tersulit untuk perkongsian di luar aplikasi, bukan e-mel automatik atau pautan awam. Pilih passphrase khas dan hantar secara berasingan. Backup penuh hanya boleh dipulihkan ke akaun yang sama dengan passphrase asal.
- Web Crypto: PBKDF2-SHA-256 (600,000 lelaran), HKDF untuk mengasingkan bahan pengesahan daripada kunci penyulitan, dan AES-256-GCM dengan IV rawak baharu bagi setiap simpanan. D1 masih mengetahui metadata seperti e-mel, masa kemas kini dan saiz ciphertext. Fail backup menyertakan e-mel akaun untuk memilih konteks pemulihan.
- Sesi dan kunci dekripsi berada dalam memori tab. Refresh mengunci vault. Padanan versi mencegah satu peranti menindih perubahan peranti lain tanpa disedari. Tiada log masuk pihak ketiga, reset passphrase atau perkhidmatan autofill/ekstensi dalam versi ini.
- Jangan simpan CVV/PIN kad pembayaran. Jangan gunakan data sebenar dalam demo. Semak keselamatan kod, binaan frontend dan konfigurasi domain sebelum deploy untuk penggunaan sebenar. Ini bukan produk yang telah diaudit.

Rujukan: [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), [Custom Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Cloudflare D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/), [Workers static assets](https://developers.cloudflare.com/workers/static-assets/binding/).

Fon Geist disertakan di bawah SIL Open Font License: `src/assets/OFL-Geist.txt`.
