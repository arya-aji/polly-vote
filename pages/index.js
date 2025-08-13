import { useState, useEffect } from "react";
import { useRouter } from "next/router";

export default function Home() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "" });
  const [errors, setErrors] = useState({});
  const [isInitializing, setIsInitializing] = useState(true);
  const router = useRouter();

  // Initialize database on component mount
  useEffect(() => {
    const initializeDB = async () => {
      try {
        const response = await fetch("/api/init-db", {
          method: "POST",
        });

        if (!response.ok) {
          console.warn("Database initialization failed, but continuing...");
        }
      } catch (error) {
        console.warn("Database initialization error:", error);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeDB();
  }, []);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Nama harus diisi";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email harus diisi";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Format email tidak valid";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      try {
        setErrors({});

        // Create or update voter in database
        const response = await fetch("/api/votes?action=create-voter", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          throw new Error("Gagal menyimpan data pemilih");
        }

        // Store voter data in localStorage for session management
        localStorage.setItem("voterData", JSON.stringify(formData));

        router.push("/voting");
      } catch (error) {
        console.error("Error creating voter:", error);
        setErrors({
          submit: "Terjadi kesalahan saat menyimpan data. Silakan coba lagi.",
        });
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-100">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <img src="/bps.png" className="w-12 h-12 mx-auto mb-4"></img>
          <h1 className="text-4xl md:text-6xl font-bold text-gray-800 mb-4">
            PRIMA
          </h1>
          <h2 className="text-2xl md:text-3xl font-semibold text-cyan-600 mb-2">
            Pemilihan Mitra Terbaik
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Berikan penilaian Anda untuk memilih mitra teladan terbaik dari
            berbagai kecamatan di BPS Jakarta Pusat
          </p>
          {isInitializing && (
            <div className="mt-4 text-sm text-cyan-600">
              <div className="animate-pulse">Menginisialisasi database...</div>
            </div>
          )}
        </div>

        <div className="max-w-md mx-auto">
          {!showForm ? (
            <div className="card text-center">
              <div className="mb-6">
                <div className="w-20 h-20 bg-cyan-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-10 h-10 text-cyan-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  Siap untuk memberikan penilaian?
                </h3>
                <p className="text-gray-600 mb-6">
                  Klik tombol di bawah untuk memulai proses voting
                </p>
              </div>
              <button
                onClick={() => setShowForm(true)}
                className="btn-primary w-full text-lg py-3"
              >
                Mulai Voting
              </button>
              <div className="mt-4">
                <button
                  onClick={() => router.push("/results")}
                  className="btn-secondary w-full"
                >
                  Lihat Hasil
                </button>
              </div>
            </div>
          ) : (
            <div className="card">
              <h3 className="text-xl font-semibold text-gray-800 mb-6 text-center">
                Data Pemilih
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={`input-field ${
                      errors.name ? "border-red-500" : ""
                    }`}
                    placeholder="Masukkan nama lengkap"
                  />
                  {errors.name && (
                    <p className="text-red-500 text-sm mt-1">{errors.name}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={`input-field ${
                      errors.email ? "border-red-500" : ""
                    }`}
                    placeholder="Masukkan email"
                  />
                  {errors.email && (
                    <p className="text-red-500 text-sm mt-1">{errors.email}</p>
                  )}
                </div>

                {errors.submit && (
                  <p className="text-red-500 text-sm text-center">
                    {errors.submit}
                  </p>
                )}

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="btn-secondary flex-1"
                  >
                    Kembali
                  </button>
                  <button type="submit" className="btn-primary flex-1">
                    Lanjutkan
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
