# Aplikasi Voting Pegawai Teladan BPS

Aplikasi web voting untuk pemilihan pegawai teladan Badan Pusat Statistik (BPS) yang dibangun dengan Next.js, JavaScript, dan Tailwind CSS.

## Fitur Utama

- **Voting System**: Penilaian kandidat berdasarkan 8 aspek dengan bobot berbeda
- **24 Kandidat**: Tersebar di 8 kecamatan (3 kandidat per kecamatan)
- **Database Integration**: Semua data voting disimpan secara permanen di NeonDB
- **Edit Voting**: Pemilih dapat mengedit penilaian berdasarkan email
- **Hasil Voting**: Halaman hasil yang dilindungi password dengan statistik real-time
- **Responsive Design**: UI yang responsif untuk desktop dan mobile
- **Validasi Form**: Validasi lengkap untuk mencegah submission yang tidak valid
- **Data Persistence**: Semua data voting tersimpan permanen di database

## Kandidat per Kecamatan

1. **Tanah Abang**: Siti Sofwati, Suherno, Luli Huriah
2. **Menteng**: Lisnawati, Ratwi, Roberto
3. **Senen**: Puji Lestari, Rina Rulina, Annisa Eka Aulia
4. **Johar Baru**: Umi Nadiroh, Yuliani zaizah, dewi damayanti
5. **Cempaka Putih**: Murni Asih, Caesar agni, fitri mulyant
6. **Kemayoran**: naufal, meita yosnita, rizalina
7. **Sawah besar**: nilam sarwani simbolon, tasya khafifah, M Ajid
8. **Gambir**: Siti Ramayanti, Padame Siahaan, Corina

## Aspek Penilaian

1. Kejujuran (15%)
2. Loyalitas (15%)
3. Penyelesaian pekerjaan (15%)
4. Kualitas pekerjaan (15%)
5. Kerjasama (10%)
6. Pengembangan diri (10%)
7. Komunikasi (10%)
8. Percaya diri (10%)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup NeonDB Database

1. **Create NeonDB Account**

   - Visit [Neon.tech](https://neon.tech) and create a free account
   - Create a new project and database

2. **Get Database Connection String**

   - In your Neon dashboard, click "Connect"
   - Copy the PostgreSQL connection string

3. **Configure Environment Variables**
   - Copy `.env.example` to `.env` (if exists) or create `.env` file
   - Add your NeonDB connection string:
   ```env
   DATABASE_URL="postgresql://username:password@endpoint.neon.tech:5432/dbname?sslmode=require"
   ADMIN_PASSWORD="xxxxxxxxxxxx"
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   ```

### 3. Initialize Database

- The application will automatically create necessary tables on first run
- Database includes tables for: `voters`, `votes`, and `voting_sessions`

### 4. Start Development Server

```bash
npm run dev
```

### 5. Access Application

- Open browser and navigate to `http://localhost:3000`
- Start voting by entering your name and email
- Complete the voting process for all candidates
- View results using admin password: `xxxxxxxxxx`

## Alur Penggunaan

1. Akses halaman utama
2. Klik "Mulai Voting"
3. Masukkan nama dan email
4. Berikan penilaian untuk semua kandidat (skala 1-5)
5. Submit hasil voting
6. Lihat hasil dengan password "xxxxxxxxxx"

## Teknologi yang Digunakan

- **Next.js 14**: React framework untuk production
- **React 18**: Library JavaScript untuk UI
- **Tailwind CSS**: Utility-first CSS framework
- **NeonDB**: Serverless PostgreSQL database
- **@neondatabase/serverless**: Database driver untuk NeonDB

## Struktur Proyek

```
polly/
├── pages/
│   ├── api/
│   │   ├── init-db.js    # Database initialization endpoint
│   │   └── votes.js      # Voting API endpoints
│   ├── index.js          # Halaman utama
│   ├── voting.js         # Halaman voting
│   ├── results.js        # Halaman hasil
│   └── _app.js           # App wrapper
├── lib/
│   └── db.js            # Database connection dan operasi
├── data/
│   └── candidates.js     # Data kandidat dan aspek
├── styles/
│   └── globals.css       # Global styles
├── .env                  # Environment variables (buat file ini)
└── package.json
```

## Password Admin

Untuk mengakses halaman hasil voting, gunakan password: **xxxxxxxxxx**

### Fitur Admin:

- Melihat hasil voting lengkap dan statistik
- Ranking kandidat real-time dengan kalkulasi berbasis database
- Statistik voting (vote lengkap vs parsial)
- Jumlah abstain per kandidat
- Tabel hasil yang dapat diurutkan dan difilter

## Database Schema

### Tabel yang Dibuat Otomatis:

1. **voters**: Menyimpan informasi pemilih

   - id, name, email, created_at, updated_at

2. **votes**: Menyimpan vote individual kandidat

   - id, voter_email, candidate_id, aspect_scores (JSON), is_abstained, is_partial, created_at, updated_at

3. **voting_sessions**: Menyimpan metadata sesi voting
   - id, voter_email, is_complete, abstained_candidates (JSON), total_candidates, completed_candidates, created_at, updated_at

## Environment Variables

Variabel environment yang diperlukan dalam file `.env`:

```env
# NeonDB Connection (Wajib)
DATABASE_URL="postgresql://username:password@endpoint.neon.tech:5432/dbname?sslmode=require"

# Konfigurasi Admin
ADMIN_PASSWORD="xxxxxxxxxxxxxxxxxxx"

# URL Aplikasi
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Catatan

- Data voting disimpan secara permanen di database NeonDB
- Pemilih dapat mengedit voting berdasarkan email yang sama
- Hasil voting menampilkan ranking berdasarkan skor total tertimbang
- UI menggunakan warna cyan sebagai warna utama sesuai permintaan
