# MASTER PROMPT & ARCHITECTURAL BLUEPRINT: LOCAL AI WEB UI (ANTI-SLOP EDITION)

Dokumen ini adalah **Blueprint Arsitektur Teknis, Spesifikasi Fungsi, Design System (UI/UX), dan Master Prompt** yang dirancang khusus untuk membangun **Web UI AI Lokal & Multi-Provider** (Ollama, LM Studio, Cloudflare Tunnel, OpenAI-Compatible, OpenRouter, & Cloud LLM) dengan standar **Anti-AI Slop**.

*(Seluruh logika bisnis spesifik kalkulasi karton/sheet pricing telah dikecualikan sepenuhnya sehingga blueprint ini 100% modular dan siap digunakan untuk pengembangan aplikasi Web UI AI lokal mandiri).*

---

## DAFTAR ISI
1. [Konstitusi Desain Anti-AI Slop (UI/UX & Visual Architecture)](#1-konstitusi-desain-anti-ai-slop-uiux--visual-architecture)
2. [Sistem Warna, Tipografi, & CSS Engineering (120Hz Mobile & Desktop)](#2-sistem-warna-tipografi--css-engineering-120hz-mobile--desktop)
3. [Arsitektur Layout & Navigasi Utama (Workspace & Sidebar)](#3-arsitektur-layout--navigasi-utama-workspace--sidebar)
4. [Fungsi Inti 1: Local AI Server Engine (Ollama, LM Studio, Cloudflare Tunnel)](#4-fungsi-inti-1-local-ai-server-engine-ollama-lm-studio-cloudflare-tunnel)
5. [Fungsi Inti 2: Multi-Provider SSE Streaming & 120fps Smooth Typewriter](#5-fungsi-inti-2-multi-provider-sse-streaming--120fps-smooth-typewriter)
6. [Fungsi Inti 3: Context Window Budgeting, Token Estimator & Response Cache](#6-fungsi-inti-3-context-window-budgeting-token-estimator--response-cache)
7. [Fungsi Inti 4: Role / Skill Library System (YAML Frontmatter `.md` & `.json`)](#7-fungsi-inti-4-role--skill-library-system-yaml-frontmatter-md--json)
8. [Fungsi Inti 5: Multimodal Input Dock (Dokumen, Excel, PDF, Kamera Live, Voice-to-Text)](#8-fungsi-inti-5-multimodal-input-dock-dokumen-excel-pdf-kamera-live-voice-to-text)
9. [Fungsi Inti 6: Rich Message Renderer (KaTeX Math, Interactive Chart, Table, Live Artifact Sandbox)](#9-fungsi-inti-6-rich-message-renderer-katex-math-interactive-chart-table-live-artifact-sandbox)
10. [Fungsi Inti 7: Backend Proxy API (`server.ts`) untuk Bypass CORS & Cloudflare Tunnel](#10-fungsi-inti-7-backend-proxy-api-serverts-untuk-bypass-cors--cloudflare-tunnel)
11. [Copy-Paste Master Prompt (Siap Pakai untuk AI Coding Agent)](#11-copy-paste-master-prompt-siap-pakai-untuk-ai-coding-agent)

---

## 1. KONSTITUSI DESAIN ANTI-AI SLOP (UI/UX & VISUAL ARCHITECTURE)

Untuk memastikan Web UI terlihat seperti perangkat lunak profesional yang dirancang oleh manusia (*crafted engineering tool*) dan bukan hasil cetakan template AI generik, patuhi aturan ketat berikut:

### A. Larangan Visual (Forbidden Tells)
1. **DILARANG Menggunakan Gradasi Biru-Ungu / Neon (No Blue-Purple Gradients):**
   - Jangan gunakan gradasi `blue-to-purple`, `cyan-to-purple`, `purple-to-pink`, atau bola cahaya blur (*radial orbs*) di latar belakang.
   - Gunakan bidang dasar (*ground plane*) warna solid matte dengan kontras tajam.
2. **DILARANG Menggunakan Glassmorphism Berlebihan (Dose Cap: Maksimal 1–2 Elemen):**
   - Jangan menaruh `backdrop-blur` pada sidebar, navbar, kartu chat, modal, dan input secara bersamaan karena akan meratakan hirarki visual (*flat frosted layer*) dan memicu *mobile fog bug* di browser seluler.
   - Permukaan utama wajib solid (`#FFFFFF` di Light Mode, `#161311` di Dark Mode, atau opasitas tinggi `98%` pada popover mengambang).
3. **Disiplin Zero-Pill (No Pill-Shaped Everything):**
   - Jangan membuat semua tombol, input, kartu, dan badge berbentuk kapsul (`rounded-full`).
   - Gunakan skala radius sudut yang tegas dan fungsional:
     - Tombol, chip, badge, select, input dalam toolbar: `rounded-xs` (`2px`–`4px`) atau `rounded-md` (`6px`).
     - Kontainer utama & kartu pesan: `rounded-lg` (`8px`).
     - Modal dialog mengambang: `rounded-xl` (`12px`) atau `rounded-2xl` (`16px`).
4. **DILARANG Menggunakan Bayangan Tebal & Glow di Semua Tempat:**
   - Mayoritas elemen harus rata dengan bidang dasar (*flat ground plane*) dan dipisahkan oleh garis batas tipis (`border-black/8 dark:border-white/10`).
   - Bayangan (`shadow-2xl`) hanya boleh dipakai pada popover/modal yang benar-benar melayang di atas halaman.
5. **DILARANG Menggunakan Ikon AI Klise & Emoji Dekoratif:**
   - Jangan menaruh ikon bintang berkilau (*sparkles/magic wand*) atau menabur emoji (🚀, ✨, 🔥, ✅) pada label UI, judul modal, maupun tombol.
   - Gunakan ikon teknis yang fungsional (`Server`, `Cpu`, `Sliders`, `BookOpen`, `Code2`, `Terminal`, `Paperclip`, `Camera`, `Mic`).
   - Satu-satunya indikator warna berbentuk titik bulat (`🟢` / dot warna) yang diizinkan adalah **indikator status nyata** (misal: Model aktif di VRAM, status koneksi provider, atau mikrofon sedang merekam).
6. **DILARANG Membuat Navigasi Mati atau Kontrol Palsu:**
   - Setiap tombol, slider parameter (`temperature`, `contextWindow`), tombol ekspor/impor, dan fitur deteksi server harus benar-benar terhubung ke fungsi nyata.

---

## 2. SISTEM WARNA, TIPOGRAFI, & CSS ENGINEERING (120HZ MOBILE & DESKTOP)

### A. Palet Warna (Warm Industrial Editorial Palette)
Maksimal 3 warna inti netral + 1 warna aksen utama + warna semantik status:

| Peran Elemen | Light Mode | Dark Mode | Keterangan |
| :--- | :--- | :--- | :--- |
| **Canvas / Latar Belakang Luar** | `#F4F2EE` | `#0E0D0C` | Latar belakang aplikasi di luar panel kerja |
| **Primary Surface (Ground Plane)** | `#FFFFFF` | `#161311` | Latar ruang chat utama, sidebar, dan modal |
| **Secondary / Muted Surface** | `#F3F1ED` / `#F9F9F9` | `#22201E` / `#1D1C1A` | Tombol toolbar, blok kode, kartu input bawah |
| **Teks Utama (Primary Text)** | `#1C1B1A` | `#F2EFE9` | Teks pesan asisten, judul, nilai input |
| **Teks Sekunder (Muted Text)** | `#737373` (`neutral-500`) | `#A3A3A3` (`neutral-400`) | Label metadata, ukuran model, timestamp |
| **Border / Garis Pemisah** | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.10)` | `border-black/8 dark:border-white/10` |
| **Primary Accent (Terracotta)** | `#C65D3B` | `#C65D3B` (Hover: `#B24F2F`) | Gelembung chat user, CTA utama, tab aktif |
| **Semantic Status: VRAM / Sukses** | `emerald-600` | `emerald-400` | Status model `VRAM Aktif`, koneksi berhasil |
| **Semantic Status: Cloud / Search** | `cyan-600` | `cyan-400` | Indikator OpenRouter / Web Search |
| **Semantic Status: Warning / 429** | `amber-600` | `amber-300` | Banner kuota limit 429 / peringatan server |
| **Semantic Status: Error / Stop** | `rose-600` | `rose-400` | Tombol Stop Stream, indikator rekaman suara |

### B. Sistem Tipografi
- **UI & Percakapan (`--font-sans`):** Sans-serif humanis dengan keterbacaan tinggi untuk teks panjang dan multibahasa.
- **Heading & Struktur (`--font-display`):** `"Plus Jakarta Sans"`, bold, `tracking-tight` untuk header panel dan judul modal.
- **Data Teknis, Kode, Nama Model, & Angka (`--font-mono`):** `"JetBrains Mono"` dengan `font-variant-numeric: tabular-nums` untuk ID model (`qwen2.5-coder:7b`), ukuran VRAM (`4.7 GB`), kuantisasi (`Q4_K_M`), parameter `temperature`, dan blok kode.

### C. Aturan Wajib Global CSS (`index.css`)
1. **Kunci Dark Mode berbasis Class di Tailwind v4:**
   ```css
   @import "tailwindcss";
   @custom-variant dark (&:where(.dark, .dark *));
   ```
   *(Mencegah tema gelap/terang OS bentrok dengan toggle tema di dalam aplikasi web).*
2. **120Hz Smooth Scrolling Tanpa Bug Kabut Mobile (Zero-Fog Rule):**
   ```css
   html, body, aside, header, main {
     -webkit-overflow-scrolling: touch;
     overscroll-behavior-y: contain;
     /* DILARANG memasang transform: translateZ(0) atau perspective pada elemen induk */
   }
   ```
3. **Kontras Seleksi Teks (Text Selection Fix pada Gelembung User):**
   ```css
   .user-chat-bubble::selection,
   .user-chat-bubble *::selection {
     background-color: #fde68a !important;
     color: #1c1b1a !important;
   }
   ```
4. **Dukungan Unicode, Multibahasa & Rumus Matematika:**
   ```css
   .universal-chat-typography {
     unicode-bidi: plaintext;
     word-break: break-word;
     overflow-wrap: anywhere;
     font-feature-settings: "kern" 1, "liga" 1, "calt" 1;
   }
   ```

---

## 3. ARSITEKTUR LAYOUT & NAVIGASI UTAMA (WORKSPACE & SIDEBAR)

Aplikasi menggunakan struktur **Full-Viewport App Shell (`h-dvh overflow-hidden`)** sehingga halaman tidak pernah mengalami *double scrollbar*.

### A. Left Collapsible Sidebar (`SidebarHistory`)
Mengelola riwayat percakapan (*Chat Threads*) dan pengorganisasian kerja:
1. **Pencarian Real-Time & Tombol Chat Baru (`+ New Chat`):** Memfilter judul thread atau isi percakapan secara instan.
2. **Manajemen Folder Kustom:**
   - Buat folder baru (misal: `Diskusi Umum`, `Coding & Arsitektur`, `Riset Lokal`).
   - Expand/collapse folder dengan indikator jumlah thread di dalamnya.
   - **Drag-and-Drop Thread ke Folder:** Pengguna dapat menyeret item chat ke folder mana pun.
3. **Operasi Item Thread:**
   - **Pin / Unpin Thread:** Thread penting disematkan di urutan teratas.
   - **Inline Rename:** Mengubah judul thread langsung di tempat.
   - **Batch Selection Mode:** Mode centang massal (`CheckSquare`) untuk menghapus banyak percakapan sekaligus.
4. **Toggle Tema (Light / Dark Mode):** Tersedia langsung di header/footer sidebar dengan persistensi `localStorage`.

### B. Main AI Chat Workspace (`AIChatWorkspace`)
Terbagi menjadi 4 zona vertikal presisi + 1 panel kanan dinamis:
1. **Zona 1 — Pinned Topbar Island (`h-11`):**
   - **Kiri:** Pemilih Model & Provider (*Unified Floating Model & Provider Picker*) dengan indikator dot warna status provider + tombol cepat *Pindai Model* & *Atur Server*.
   - **Kanan:** Tombol *Role Library* (`Role: [Nama Role Aktif]`) dan tombol *Parameter* (`Sliders` untuk mengatur Server Lokal, VRAM, Temperature, & Context Window).
2. **Zona 2 — Messages Scroll Stage (`flex-1 overflow-y-auto`):**
   - Area pesan dengan deteksi gulir cerdas (*Smart Auto-Scroll*): otomatis menggulir ke bawah saat AI mengetik, tetapi **berhenti memaksa gulir jika pengguna sedang menggulir ke atas** untuk membaca pesan lama.
   - Menampilkan tombol melayang **`↓ Ikuti Jawaban Live`** / **`↓ Ke Bawah`** saat posisi scroll tidak di dasar.
3. **Zona 3 — Status & Preview Bar (Kondisional):**
   - Muncul di atas input dock hanya saat ada status aktif: Banner *Loading Model ke VRAM*, Banner *Rate Limit 429 Auto-Fallback*, Bar *Voice-to-Text Live*, atau deretan *Thumbnail Lampiran Foto/Dokumen* beserta *Active Tool Chips* (`Web Search`, `Deep Research`, `Canvas Preview`).
4. **Zona 4 — Bottom Multimodal Input Dock:**
   - Tombol `+` (*Multimodal & Tools Popover Menu*).
   - `textarea` auto-resize (1 hingga 5 baris) dengan dukungan `Enter` untuk kirim dan `Shift+Enter` untuk baris baru, serta dukungan `Ctrl+V` (*Paste* gambar langsung dari clipboard).
   - Tombol Mikrofon (*Voice-to-Text* ID/EN).
   - Tombol **Kirim** (`#C65D3B`) yang otomatis berubah menjadi tombol **Stop** (`bg-rose-600`) selama streaming berlangsung.
5. **Zona 5 — Right Split-Pane Live Artifact Sandbox (`w-80 sm:w-96`, Kondisional):**
   - Terbuka otomatis atau saat pengguna mengklik **`Open Artifact`** pada pesan asisten yang mengandung kode HTML, SVG, JSON, atau TSX/JSX.

---

## 4. FUNGSI INTI 1: LOCAL AI SERVER ENGINE (OLLAMA, LM STUDIO, CLOUDFLARE TUNNEL)

Bagian ini adalah jantung dari Web UI AI Lokal Anda. Sistem harus mampu berbicara dengan **Ollama**, **LM Studio**, maupun server lokal yang diekspos lewat **Cloudflare Tunnel / Reverse Proxy** (misal `https://api.domainanda.id`).

### A. Normalisasi URL Endpoint (`normalizeLocalEndpoint`)
- Jika pengguna mengetik `localhost:1234` atau `192.168.1.10:11434`, otomatis tambahkan `http://`.
- Jika pengguna mengetik domain publik/tunnel seperti `api.domainanda.id` (tanpa protokol dan bukan IP lokal), otomatis tambahkan `https://`.
- Bersihkan trailing slash `/` atau akhiran `/v1` secara cerdas saat memanggil endpoint manajemen model.

### B. Deteksi Model & Status VRAM Paralel (`detectLocalModels`)
Saat pengguna menekan tombol **Pindai / Deteksi Model**, sistem memeriksa endpoint berikut untuk mengenali jenis server, latensi (`ms`), daftar model di disk, dan model mana yang **sedang aktif di VRAM**:
1. **Probing Ollama (`/api/tags` + `/api/ps`):**
   - `/api/tags` mengembalikan semua model yang terinstal di disk beserta metadata `details.parameter_size` (misal `7B`), `details.quantization_level` (misal `Q4_K_M`), `details.family`, dan ukuran byte (`size`).
   - `/api/ps` mengembalikan daftar model yang saat ini sedang dimuat di dalam VRAM GPU.
   - Setiap model yang cocok dengan `/api/ps` diberi status `isLoaded: true` dan badge **`🟢 VRAM Aktif`**, sedangkan sisanya diberi badge **`⚪ Di Disk`**.
2. **Probing LM Studio (`/api/v0/models`):**
   - Membaca properti `state === 'loaded'` untuk menentukan apakah model sedang aktif di VRAM (`🟢 VRAM Aktif`) atau masih di disk (`LM Studio · Disk`), beserta informasi arsitektur dan kuantisasi.
3. **Probing OpenAI-Compatible (`/v1/models`):**
   - Fallback universal untuk server `llama.cpp`, `vLLM`, `LocalAI`, atau gateway OpenAI-compatible lainnya.

### C. Auto-Load & Manual Load Model ke VRAM (`loadLocalModel`)
Fitur krusial agar pengguna tidak mengalami error *model not loaded* atau *cold-start timeout* saat berganti model lokal:
- **Toggle `Auto-Load Model saat Dipilih`:** Jika aktif, begitu pengguna memilih model yang berstatus `⚪ Di Disk` dari dropdown, UI menampilkan banner *Memuat model ke VRAM...* dan memicu preload:
  1. **Untuk Ollama:** Mengirim `POST /api/generate` dengan payload `{ model: modelId, keep_alive: "15m" }`.
  2. **Untuk LM Studio:** Mengirim `POST /api/v0/models/load` dengan payload `{ modelKey: modelId, identifier: modelId }`.
  3. **Warmup Fallback:** Mengirim ping `POST /v1/chat/completions` dengan `max_tokens: 1`.
- Setelah selesai, status model di UI langsung berubah menjadi **`🟢 Aktif di VRAM`** lengkap dengan informasi waktu muat (`latencyMs`).

### D. Tarik Model Baru Langsung dari Web UI (`pullLocalModel` — Ollama Pull)
- Menyediakan input teks di dalam Modal Pengaturan Server Lokal (contoh: `qwen2.5:3b`, `deepseek-r1:8b`, `llama3.2:3b`).
- Mengirim permintaan ke `/api/pull` pada server Ollama (`{ name: modelName, stream: false }`), menampilkan indikator unduhan, dan otomatis memindai ulang daftar model setelah selesai.

### E. Smart Retry HTTP 400 pada LM Studio
- Beberapa model di LM Studio menolak parameter `max_tokens` jika melebihi sisa *context length* yang dikonfigurasi di server dan mengembalikan `HTTP 400`.
- Engine streaming wajib memiliki **Smart Retry**: jika request pertama dengan `max_tokens: 2048` mengembalikan status `400` pada provider `local`, otomatis ulangi request tanpa field `max_tokens` secara transparan.

---

## 5. FUNGSI INTI 2: MULTI-PROVIDER SSE STREAMING & 120FPS SMOOTH TYPEWRITER

### A. Dukungan 3 Kategori Provider dalam 1 Antarmuka
1. **Local LM (`local`):** Ollama (`:11434`), LM Studio (`:1234`), atau Cloudflare Tunnel pribadi via format OpenAI-compatible SSE (`/v1/chat/completions`), lengkap dengan ekstraksi `delta.content` dan `delta.reasoning_content` (untuk model penalaran seperti DeepSeek-R1 / QwQ).
2. **OpenRouter / OpenAI-Compatible Cloud (`qwen`):** Mendukung rantai *Auto-Fallback* beberapa model gratis/berbayar secara berurutan jika satu model sedang penuh.
3. **Google Gemini Cloud (`gemini`):** Mendukung streaming SSE, *Web Search Grounding*, dan rantai *Auto-Fallback* saat terjadi HTTP 429/503.

### B. 120fps `requestAnimationFrame` Smooth Streaming Buffer
JANGAN memperbarui state React setiap kali satu potongan kecil jaringan (*network packet*) masuk, karena akan menyebabkan teks tersendat (*stuttering*) atau *layout thrashing*:
- Simpan seluruh teks yang masuk dari jaringan ke variabel `targetText` di dalam closure streaming.
- Jalankan loop `requestAnimationFrame` (`tickTypewriter`) yang mengalirkan karakter dari `targetText` ke `displayedText` dengan kecepatan adaptif:
  ```ts
  const backlog = targetText.length - displayedText.length;
  const step = Math.max(2, Math.min(48, Math.ceil(backlog * 0.28)));
  displayedText = targetText.slice(0, displayedText.length + step);
  ```
- Hasilnya: animasi ketikan berjalan mulus di layar 60Hz–120Hz meskipun jaringan mengirimkan token dalam ledakan (*burst*) yang tidak merata.

### C. Dukungan Chain-of-Thought / Reasoning Collapsible Block
- Jika model lokal (seperti `DeepSeek-R1` atau `QwQ`) mengirimkan token penalaran (`reasoning_content` atau blok `<think>...</think>`), pisahkan ke dalam properti `message.reasoning`.
- Tampilkan di atas jawaban utama menggunakan komponen `<details>` lipat (*collapsible*) berlabel **"Proses Penalaran (Chain-of-Thought)"** dengan font monospace.

---

## 6. FUNGSI INTI 3: CONTEXT WINDOW BUDGETING, TOKEN ESTIMATOR & RESPONSE CACHE

Server AI lokal memiliki keterbatasan VRAM yang ketat. Web UI wajib memiliki manajemen memori konteks otomatis:

### A. Token Estimator (`estimateTokens`)
- Menghitung estimasi jumlah token dari teks dan lampiran (`Math.ceil(text.length / 3.8)` ditambah bobot ~400 token per gambar terlampir).

### B. Context Window Budgeting (`truncateMessagesByBudget`)
- Pengguna dapat mengatur slider **Batas Context Window** (misal `2048` hingga `16384` token) di modal pengaturan.
- Sebelum mengirim riwayat chat ke server lokal, fungsi `truncateMessagesByBudget` menghitung token mulai dari `System Prompt` + **pesan terbaru pengguna (beserta file terlampir)**, lalu berjalan mundur memasukkan pesan-pesan sebelumnya selama total token belum melewati batas `contextWindow`.
- Pesan lama yang melebihi anggaran VRAM otomatis dipangkas tanpa memutus pesan terbaru.

### C. Deterministic Local Response Cache
- Menyimpan pasangan `(hash(prompt + activeRoleId), response)` di memori/storage untuk pertanyaan non-file yang identik, sehingga pengujian berulang dapat disajikan secara instan bila diperlukan.

---

## 7. FUNGSI INTI 4: ROLE / SKILL LIBRARY SYSTEM (YAML FRONTMATTER `.MD` & `.JSON`)

Memungkinkan pengguna mengubah kepribadian, instruksi sistem (*System Prompt*), dan *temperature* AI secara instan:

1. **CRUD Peran di Dalam UI:**
   - Buat peran baru, edit nama, deskripsi, kategori (`general`, `coding`, `writing`, `academic`, `analysis`, `custom`), nilai default `temperature` (`0.0` – `1.0`), dan isi `System Prompt`.
2. **Impor & Ekspor File Markdown (`.md`) dengan YAML Frontmatter:**
   - Setiap peran dapat diekspor atau diimpor dari file `.md` standar dengan format:
     ```markdown
     ---
     name: "Anti-Slop UI & Visual Architect"
     description: "Spesialis UI/UX anti-AI slop & clean minimalism"
     category: "coding"
     temperature: 0.2
     ---

     # SYSTEM PROMPT
     Instruksi detail peran di sini...
     ```
3. **Ekspor & Impor Koleksi JSON (`.json`)** serta tombol **Reset Default** untuk mengembalikan daftar peran bawaan.

---

## 8. FUNGSI INTI 5: MULTIMODAL INPUT DOCK (DOKUMEN, EXCEL, PDF, KAMERA LIVE, VOICE-TO-TEXT)

Input dock di bagian bawah mendukung interaksi multimodal lengkap:

### A. Universal Document Parser (`documentParser.ts`)
Saat pengguna menyeret file (*Drag & Drop* ke area chat) atau memilih file lewat menu `+`:
1. **Spreadsheet (`.xlsx`, `.xls`, `.csv`, `.tsv`):**
   - Dibaca di sisi klien menggunakan `xlsx` (SheetJS).
   - Hingga 10 sheet dan 200 baris per sheet otomatis dikonversi menjadi **Tabel Markdown (`| Kolom | ... |`)** yang rapi sehingga LLM lokal maupun cloud dapat menganalisis angka dan baris tabel secara akurat.
2. **Dokumen Word (`.docx`, `.doc`):**
   - Mengekstrak teks mentah menggunakan `mammoth` di browser, dengan fallback ekstraksi string ASCII untuk `.doc` klasik.
3. **Dokumen PDF (`.pdf`):**
   - Mengekstrak teks per halaman melalui endpoint parser atau pemindai stream `BT...ET`, sekaligus menyertakan `base64Data` untuk model multimodal.
4. **File Kode & Teks (`.txt`, `.md`, `.json`, `.ts`, `.tsx`, `.py`, `.sql`, `.html`, `.css`, `.log`):**
   - Dibaca hingga 48.000 karakter dan dibungkus dalam blok kode berpenanda `--- FILE TERLAMPIR: nama_file ---` di dalam konteks pesan.

### B. Kompresi Gambar Otomatis & Clipboard Paste
- Gambar dari galeri, drag-and-drop, atau `Ctrl+V` (*clipboard paste*) otomatis dikompresi via HTML5 `<canvas>` (resolusi maks ~1280px, kualitas JPEG `0.82`) menjadi Base64 agar hemat bandwidth dan tidak membuat payload JSON ke server lokal membengkak.

### C. Live WebRTC Camera Modal
- Membuka modal kamera langsung di browser (`navigator.mediaDevices.getUserMedia`) dengan tombol **Putar Kamera** (`environment` / `user`), tombol **Jepret Foto** (mengambil frame `<video>` ke `<canvas>`), serta tombol fallback **Kamera Perangkat (Native)** untuk smartphone.

### D. Voice-to-Text (Web Speech API) Dual-Language (`id-ID` & `en-US`)
- Menggunakan `SpeechRecognition` / `webkitSpeechRecognition` dengan mode `continuous: true` dan `interimResults: true`.
- Menampilkan bar aktif dengan indikator titik merah berdenyut (*satu-satunya elemen yang boleh berdenyut karena menandakan mikrofon benar-benar sedang merekam*), transkripsi sementara (*interim text*) secara live, tombol ganti bahasa `ID (Indonesia)` / `EN (English)`, tombol `Selesai`, dan tombol `Kirim` langsung.

### E. Toggle Mode Alat Ekstra di Menu `+`
- **Web Search Grounding (`Globe`):** Mengaktifkan pencarian web real-time (jika didukung provider).
- **Deep Research / Reasoning (`Brain`):** Menginstruksikan AI melakukan analisis mendalam langkah demi langkah.
- **Canvas Preview (`Palette`):** Menginstruksikan AI menghasilkan kode visual interaktif (HTML/SVG) yang langsung dirender di panel Artifact kanan.

---

## 9. FUNGSI INTI 6: RICH MESSAGE RENDERER (KATEX MATH, INTERACTIVE CHART, TABLE, LIVE ARTIFACT SANDBOX)

Komponen `RichMessageContent.tsx` merender output Markdown AI menjadi elemen UI kelas produksi tanpa library berat yang merusak performa:

1. **Tipografi & Rumus Matematika KaTeX (`katex`):**
   - Merender rumus blok `$$...$$` dan `\[...\]` serta rumus inline `$...$` dan `\(...\)`.
   - Mendeteksi secara cerdas jika AI menulis sintaks LaTeX di dalam backtick (seperti `` `\frac{a}{b}` ``) dan merendernya menjadi rumus matematika visual.
2. **Interactive Chart Block (`ResponsiveChartBlock`):**
   - Jika AI mengeluarkan blok kode ```` ```chart ```` atau ```` ```json-chart ```` berisi JSON `{ type: "bar" | "line", title, unit, data: [{ label, value }] }`, otomatis dirender menjadi komponen grafik interaktif dengan tombol switcher **Bar / Line** dan grafik SVG/CSS yang responsif.
3. **Interactive Data Table (`ResponsiveTableBlock`):**
   - Tabel Markdown otomatis dirender dengan header tegas, angka `tabular-nums`, scroll horizontal halus, serta tombol **Salin CSV** di pojok kanan atas tabel dan tombol **Visualisasikan Grafik** jika tabel berisi kolom numerik.
4. **Syntax Code Block dengan Copy Button:**
   - Blok kode ```` ```bahasa ```` menampilkan header bahasa monospace dan tombol **Salin Kode** dengan umpan balik `Tersalin`.
5. **Split-Pane Live Artifact Sandbox (`extractCodeArtifact`):**
   - Jika jawaban AI mengandung kode `html`, `svg`, `json`, `tsx`, atau `jsx` (≥ 40 karakter), muncul tombol **`Open Artifact`** di kaki pesan.
   - Saat diklik, panel kanan terbuka menampilkan **Live Preview `<iframe sandbox="allow-scripts">`** (untuk HTML/SVG) beserta tampilan kode sumbernya.

---

## 10. FUNGSI INTI 7: BACKEND PROXY API (`server.ts`) UNTUK BYPASS CORS & CLOUDFLARE TUNNEL

Ketika Web UI dijalankan di browser (terutama melalui HTTPS) dan pengguna menghubungkannya ke `http://localhost:11434`, `http://localhost:1234`, atau Cloudflare Tunnel, browser sering memblokir koneksi langsung karena **CORS** atau **Mixed Content (HTTPS ke HTTP)**.

Oleh karena itu, backend Express (`server.ts`) wajib menyediakan 4 endpoint proxy penyelamat (*Auto-Rescue Proxy*):

1. **`GET /api/local/detect?endpoint=...`**
   - Melakukan probing paralel (`Promise.allSettled`) dari sisi server Node.js ke `/api/tags`, `/api/ps`, `/api/v0/models`, dan `/v1/models` milik server lokal dengan timeout 4.5 detik.
   - Mendeteksi kode error Cloudflare Tunnel (`502, 503, 504, 520, 522, 530`) dan memberikan pesan diagnostik yang jelas.
2. **`POST /api/local/load`**
   - Memuat model ke VRAM Ollama (`/api/generate` dengan `keep_alive: '15m'`) atau LM Studio (`/api/v0/models/load`) dari sisi server untuk menghindari blokir preflight `OPTIONS` di browser.
3. **`POST /api/local/pull`**
   - Memicu `POST /api/pull` pada server Ollama untuk mengunduh model baru.
4. **`POST /api/local/stream`**
   - Meneruskan streaming SSE dari `/v1/chat/completions` atau `/api/chat` milik server lokal ke browser jika `fetch` langsung dari browser gagal akibat CORS/Mixed-Content.

---

## 11. COPY-PASTE MASTER PROMPT (SIAP PAKAI UNTUK AI CODING AGENT)

Anda dapat menyalin seluruh blok prompt di bawah ini dan memberikannya langsung kepada AI Coding Agent (Cursor, Windsurf, Claude Code, AI Studio, atau Local Coding Agent Anda) untuk membangun aplikasi Web UI AI Lokal ini dari nol:

```markdown
# TASK: BUILD A PRODUCTION-GRADE LOCAL AI & MULTI-PROVIDER WEB UI (STRICT ANTI-SLOP CONSTITUTION)

Build a complete, responsive, full-stack React + TypeScript + Tailwind CSS + Express (`server.ts`) Web UI for Local LLMs (Ollama, LM Studio, Cloudflare Tunnel, OpenAI-Compatible) and Cloud LLMs (Google Gemini / OpenRouter).

## 1. STRICT ANTI-AI SLOP UI/UX RULES
- **NO Blue-Purple or Neon Gradients:** Never use generic blue-to-purple gradients or glowing background orbs.
- **Warm Industrial Editorial Palette:**
  - Light mode surfaces: Canvas `#F4F2EE`, Primary `#FFFFFF`, Secondary `#F3F1ED`, Text `#1C1B1A`.
  - Dark mode surfaces: Canvas `#0E0D0C`, Primary `#161311`, Secondary `#22201E`, Text `#F2EFE9`.
  - Single intentional accent color: Terracotta `#C65D3B` (Hover `#B24F2F`).
  - Borders: `border-black/8 dark:border-white/10`.
- **Zero-Pill Discipline:** Do NOT use `rounded-full` on buttons, inputs, cards, or badges. Use `rounded-xs` (2px-4px) for toolbar controls/chips, `rounded-md` (6px) for chat bubbles and cards, and `rounded-xl` for modals.
- **No Excessive Glassmorphism:** Keep main surfaces solid matte. Use `backdrop-blur` on at most 1-2 modal overlays.
- **No Decorative AI Sparkles or Emojis:** Do not put ✨, 🚀, or 🔥 in UI labels. Use functional Lucide technical icons (`Server`, `Cpu`, `Sliders`, `BookOpen`, `Code2`, `Paperclip`, `Camera`, `Mic`). Status dots are allowed ONLY for real states (VRAM active, provider connected, microphone recording).
- **120Hz Mobile & Desktop CSS Discipline:**
  - Lock dark mode in Tailwind v4 using `@custom-variant dark (&:where(.dark, .dark *));`.
  - Use `h-dvh overflow-hidden` on the root shell. Never attach `transform: translateZ(0)` to root containers.
  - Ensure high-contrast text selection inside user chat bubbles (`selection:bg-[#FDE68A] selection:text-[#1C1B1A]`).

## 2. CORE LAYOUT ARCHITECTURE
1. **Left Collapsible Sidebar (`SidebarHistory`):**
   - Search threads, `+ New Chat` button, custom collapsible folders (`General`, `Architecture & Dev`, `Research`), drag-and-drop threads into folders, pin/unpin threads, inline rename, batch multi-select delete, and Light/Dark theme switcher persisted in `localStorage`.
2. **Main Chat Workspace (`AIChatWorkspace`):**
   - **Pinned Topbar Island (`h-11`):**
     - Left: Unified Floating Model & Provider Picker (`Local LM`, `OpenRouter`, `Google Gemini`) showing real-time VRAM badges (`🟢 VRAM Aktif` vs `⚪ Di Disk`), one-click `Pindai` (Scan local server), and `Atur Server` button.
     - Right: Active Role badge (`Role: ...`) opening the Role Library Modal, and `Parameter` button opening the Server & Engine Configuration Modal.
   - **Messages Scroll Stage:**
     - Smart auto-scroll that respects user upward scrolling and displays a floating `↓ Ikuti Jawaban Live` button when scrolled up.
     - User messages on the right (`bg-[#C65D3B] text-white rounded-md`), Assistant messages full-width clean editorial layout with collapsible Chain-of-Thought (`<details>`) when `reasoning` tokens exist.
   - **Bottom Multimodal Input Dock:**
     - `+` Popover Menu (Upload Document/Excel/PDF, Upload Photo, Live WebRTC Camera Modal, Toggle Web Search, Toggle Deep Reasoning, Toggle Canvas Preview).
     - Auto-resizing `textarea` supporting clipboard image paste (`Ctrl+V`), `Enter` to send, `Shift+Enter` for newline.
     - Dual-language Voice-to-Text (`id-ID` and `en-US`) using Web Speech API with live interim transcript bar.
     - Send button (`#C65D3B`) that morphs into a Stop Streaming button (`bg-rose-600`) during generation.
   - **Right Split-Pane Live Artifact Sandbox (`w-80 sm:w-96`):**
     - Detects HTML, SVG, JSON, or TSX code blocks in assistant responses and renders a live sandboxed `<iframe sandbox="allow-scripts">` preview alongside the formatted code.

## 3. LOCAL AI SERVER MANAGEMENT & VRAM ENGINE
- **Endpoint Normalizer:** Automatically prefix `http://` for `localhost` / LAN IPs and `https://` for custom domains / Cloudflare tunnels.
- **Parallel Server Detection (`/api/local/detect` + client fallback):**
  - Probe Ollama (`/api/tags` and `/api/ps`), LM Studio (`/api/v0/models`), and OpenAI-compatible (`/v1/models`).
  - Extract model ID, parameter size (`7B`), quantization (`Q4_K_M`), file size (`4.7 GB`), and live VRAM status (`isLoaded`).
- **Auto-Load & Manual Load to VRAM (`/api/local/load`):**
  - When selecting an unloaded local model (or clicking `Load ke VRAM`), preload it into GPU memory via Ollama `/api/generate` (`keep_alive: "15m"`), LM Studio `/api/v0/models/load`, or a 1-token `/v1/chat/completions` warmup ping.
- **Ollama Model Puller (`/api/local/pull`):**
  - Input field inside the Local Server Modal to pull new Ollama models directly from the UI.
- **Context Window Budgeting & 120fps Streaming:**
  - Slider for `Temperature` (`0.0` - `1.0`) and `Context Window` (`2048` - `16384` tokens) that truncates older history turns while preserving the system prompt and latest user turn + attachments.
  - Render incoming SSE chunks through a `requestAnimationFrame` typewriter buffer for 120fps smoothness.
  - Automatically retry HTTP 400 errors on LM Studio without `max_tokens`, and auto-rescue CORS/Mixed-Content browser failures through the Express `/api/local/stream` proxy.

## 4. MULTIMODAL PARSING & RICH MESSAGE RENDERING
- **Client-Side Document Parser:**
  - Parse `.xlsx`, `.xls`, `.csv` via SheetJS (`xlsx`) into clean Markdown tables.
  - Parse `.docx` via `mammoth`, `.pdf`, and code/text files into structured context blocks.
  - Compress attached/pasted images via HTML5 Canvas before encoding to Base64.
- **Rich Message Renderer:**
  - Render LaTeX math (`$$...$$`, `$...$`) using `katex`.
  - Render interactive Bar/Line charts from ```` ```chart ```` JSON blocks.
  - Render Markdown tables with one-click **Copy CSV** and **Visualize Chart** buttons.
  - Provide a Role Library Modal supporting full CRUD plus `.md` (YAML frontmatter) and `.json` import/export.
```
