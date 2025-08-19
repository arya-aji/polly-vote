import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { districts, aspects, getAllCandidates } from "../data/candidates";
import Modal from "../components/Modal";

export default function Results() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [sortBy, setSortBy] = useState("averageScore");
  const [sortOrder, setSortOrder] = useState("desc");
  const [filterDistrict, setFilterDistrict] = useState("");
  const [totalVoters, setTotalVoters] = useState(0);
  const [completeVotes, setCompleteVotes] = useState(0);
  const [partialVotes, setPartialVotes] = useState(0);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [candidateVoters, setCandidateVoters] = useState([]);
  const [loadingVoters, setLoadingVoters] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();

  const ADMIN_PASSWORD = "Admin3173";

  useEffect(() => {
    if (isAuthenticated) {
      loadResults();
    }
  }, [isAuthenticated]);
  
  // Function to load voters for a specific candidate
  const loadCandidateVoters = async (candidateId, candidateName) => {
    try {
      setLoadingVoters(true);
      setSelectedCandidate(candidateName);
      setIsModalOpen(true);
      
      const response = await fetch(`/api/votes?action=candidateVoters&candidateId=${candidateId}`);
      if (!response.ok) {
        throw new Error('Failed to load candidate voters');
      }
      
      const data = await response.json();
      setCandidateVoters(data);
    } catch (error) {
      console.error('Error loading candidate voters:', error);
      setCandidateVoters([]);
    } finally {
      setLoadingVoters(false);
    }
  };
  
  // Function to close the modal
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedCandidate(null);
    setCandidateVoters([]);
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (
      password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD ||
      password === ADMIN_PASSWORD
    ) {
      setIsAuthenticated(true);
      setError("");
    } else {
      setError("Password salah!");
    }
  };

  const loadResults = async () => {
    try {
      setLoading(true);

      // Get voting statistics from database
      const response = await fetch("/api/votes?action=statistics");
      if (!response.ok) {
        throw new Error("Failed to load results");
      }

      const data = await response.json();

      setTotalVoters(data.totalVoters);
      setCompleteVotes(data.completeVotes);
      setPartialVotes(data.partialVotes);

      // Process candidate statistics
      const processedResults = [];

      // Process each candidate sequentially with await
      for (const stat of data.candidateStats) {
        // Find candidate info from our candidates data
        const candidate = getAllCandidates().find(
          (c) => c.name === stat.candidate_id
        ) || {
          name: stat.candidate_id,
          district: "Unknown",
        };

        // Calculate average aspect scores if available
        let aspectScores = {};

        // Initialize aspect scores with default values
        aspects.forEach((aspect) => {
          aspectScores[aspect.name] = "N/A";
        });

        // Try to get aspect scores from votes
        try {
          // Get votes for this candidate
          const candidateVotes = await fetch(
            `/api/votes?action=candidateVotes&candidateId=${stat.candidate_id}`
          );
          const votesData = await candidateVotes.json();

          // Ensure votesData is an array
          const votesArray = Array.isArray(votesData) ? votesData : [];

          if (votesArray.length > 0) {
            // Group votes by voter_email, keeping only the latest
            const latestVotes = {};

            votesArray.forEach((vote) => {
              if (vote && !vote.is_abstained && vote.aspect_scores) {
                const key = vote.voter_email;
                if (
                  !latestVotes[key] ||
                  new Date(vote.updated_at) >
                    new Date(latestVotes[key].updated_at)
                ) {
                  latestVotes[key] = vote;
                }
              }
            });

            // Calculate average scores from latest votes
            const validVotes = Object.values(latestVotes);

            if (validVotes.length > 0) {
              // Initialize counters for each aspect
              const aspectTotals = {};
              const aspectVoterCounts = {};

              // Initialize counters
              aspects.forEach((aspect) => {
                aspectTotals[aspect.name] = 0;
                aspectVoterCounts[aspect.name] = 0;
              });

              // Sum up scores for each aspect
              validVotes.forEach((vote) => {
                if (vote.aspect_scores) {
                  Object.keys(vote.aspect_scores).forEach((aspectKey) => {
                    // Map aspect keys from database to aspect names in our config
                    const matchingAspect = aspects.find(
                      (a) => a.name.toLowerCase() === aspectKey.toLowerCase()
                    );
                    if (matchingAspect) {
                      const score = parseFloat(
                        vote.aspect_scores[aspectKey] || 0
                      );
                      // Only count non-zero scores (not abstained)
                      if (score > 0) {
                        aspectTotals[matchingAspect.name] += score;
                        aspectVoterCounts[matchingAspect.name]++;
                      }
                    }
                  });
                }
              });

              // Calculate averages, only dividing by non-abstained voters
              Object.keys(aspectTotals).forEach((aspect) => {
                aspectScores[aspect] =
                  aspectVoterCounts[aspect] > 0
                    ? (
                        aspectTotals[aspect] / aspectVoterCounts[aspect]
                      ).toFixed(2)
                    : "N/A";
              });
            }
          }
        } catch (error) {
          console.error("Error getting candidate votes:", error);
        }

        processedResults.push({
          ...candidate,
          totalVotes: parseInt(stat.total_votes),
          validVotes: parseInt(stat.valid_votes),
          abstainCount: parseInt(stat.abstained_votes),
          averageScore: stat.average_score
            ? parseFloat(stat.average_score).toFixed(2)
            : "0.00",
          aspectScores: aspectScores,
        });
      }

      setResults(processedResults);
    } catch (error) {
      console.error("Error loading results:", error);
      setResults([]);
      setTotalVoters(0);
      setCompleteVotes(0);
      setPartialVotes(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const getSortedAndFilteredResults = () => {
    let filtered = results;

    if (filterDistrict && filterDistrict !== "") {
      filtered = results.filter((result) => result.district === filterDistrict);
    }

    return filtered.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case "name":
          aValue = a.name;
          bValue = b.name;
          break;
        case "district":
          aValue = a.district;
          bValue = b.district;
          break;
        case "validVotes":
          aValue = a.validVotes || 0;
          bValue = b.validVotes || 0;
          break;
        case "abstainCount":
          aValue = a.abstainCount || 0;
          bValue = b.abstainCount || 0;
          break;
        case "averageScore":
        default:
          aValue = parseFloat(a.averageScore || 0);
          bValue = parseFloat(b.averageScore || 0);
          break;
      }

      if (typeof aValue === "string") {
        return sortOrder === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
      }
    });
  };

  const getTopCandidates = (count = 3) => {
    return results
      .sort((a, b) => parseFloat(b.averageScore) - parseFloat(a.averageScore))
      .slice(0, count);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-100 flex items-center justify-center">
        <div className="card max-w-md mx-auto">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Akses Terbatas
            </h2>
            <p className="text-gray-600">
              Masukkan password untuk melihat hasil voting
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit}>
            <div className="mb-4">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`input-field ${error ? "border-red-500" : ""}`}
                placeholder="Masukkan password"
              />
              {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="btn-secondary flex-1"
              >
                Kembali
              </button>
              <button type="submit" className="btn-primary flex-1">
                Masuk
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const sortedResults = getSortedAndFilteredResults();
  const topCandidates = getTopCandidates();

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8 px-2">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800 mb-2">
            Hasil Voting Pegawai Teladan BPS
          </h1>
          <p className="text-gray-600">Total Pemilih: {totalVoters} orang</p>
          <div className="mt-2 flex flex-col sm:flex-row justify-center sm:space-x-4 space-y-1 sm:space-y-0 text-sm">
            <span className="text-green-600">
              ✓ Voting Lengkap: {completeVotes}
            </span>
            <span className="text-orange-600">
              ⚠ Voting Sebagian: {partialVotes}
            </span>
          </div>
        </div>

        {/* Top 3 Candidates */}
        {topCandidates.length > 0 && (
          <div className="max-w-6xl mx-auto mb-6 sm:mb-8 px-2">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6 text-center">
              🏆 Top 3 Kandidat Terbaik
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
              {topCandidates.map((candidate, index) => (
                <div
                  key={candidate.name}
                  className={`card text-center ${
                    index === 0
                      ? "ring-2 ring-yellow-400 bg-yellow-50"
                      : index === 1
                      ? "ring-2 ring-gray-400 bg-gray-50"
                      : "ring-2 ring-orange-400 bg-orange-50"
                  }`}
                >
                  <div
                    className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 ${
                      index === 0
                        ? "bg-yellow-400 text-white"
                        : index === 1
                        ? "bg-gray-400 text-white"
                        : "bg-orange-400 text-white"
                    }`}
                  >
                    <span className="text-xl sm:text-2xl font-bold">#{index + 1}</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-1">
                    {candidate.name}
                  </h3>
                  <p className="text-cyan-600 font-medium mb-2 text-sm sm:text-base">
                    {candidate.district}
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">
                    {candidate.averageScore}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600">
                    {candidate.validVotes} pemilih
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters and Controls */}
        <div className="max-w-6xl mx-auto mb-6">
          <div className="card">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="w-full sm:w-auto">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filter Kecamatan:
                </label>
                <select
                  value={filterDistrict}
                  onChange={(e) => setFilterDistrict(e.target.value)}
                  className="input-field w-full sm:w-auto"
                >
                  <option value="">Semua Kecamatan</option>
                  {Object.keys(districts).map((district) => (
                    <option key={district} value={district}>
                      {district}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => router.push("/")}
                className="btn-secondary w-full sm:w-auto mt-2 sm:mt-0"
              >
                Kembali ke Beranda
              </button>
            </div>
          </div>
        </div>

        {/* Results Table */}
        <div className="max-w-6xl mx-auto">
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              {/* Desktop Table - Hidden on small screens */}
              <table className="w-full hidden md:table">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Peringkat
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("name")}
                    >
                      Nama{" "}
                      {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("district")}
                    >
                      Kecamatan{" "}
                      {sortBy === "district" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("averageScore")}
                    >
                      Skor Total{" "}
                      {sortBy === "averageScore" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    {aspects.map((aspect) => (
                      <th
                        key={aspect.name}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {aspect.name} ({aspect.weight}%)
                      </th>
                    ))}
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("validVotes")}
                    >
                      Vote Valid{" "}
                      {sortBy === "validVotes" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("abstainCount")}
                    >
                      Abstain{" "}
                      {sortBy === "abstainCount" &&
                        (sortOrder === "asc" ? "↑" : "↓")}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td
                        colSpan="6"
                        className="px-6 py-4 text-center text-sm text-gray-500"
                      >
                        Memuat data...
                      </td>
                    </tr>
                  ) : sortedResults.length === 0 ? (
                    <tr>
                      <td
                        colSpan="6"
                        className="px-6 py-4 text-center text-sm text-gray-500"
                      >
                        Belum ada data hasil voting
                      </td>
                    </tr>
                  ) : (
                    sortedResults.map((candidate, index) => (
                      <tr
                        key={candidate.name}
                        className={
                          index < 3 ? "bg-yellow-50" : "hover:bg-gray-50"
                        }
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          #{index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          <button 
                            onClick={() => loadCandidateVoters(candidate.name, candidate.name)}
                            className="text-blue-600 hover:text-blue-800 hover:underline focus:outline-none"
                          >
                            {candidate.name}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-cyan-600 font-medium">
                          {candidate.district}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-gray-900">
                            {candidate.averageScore}
                          </div>
                        </td>
                        {aspects.map((aspect) => (
                          <td
                            key={aspect.name}
                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          >
                            {candidate.aspectScores[aspect.name] === "0" || candidate.aspectScores[aspect.name] === 0 ? 
                              "abstain" : candidate.aspectScores[aspect.name] || "N/A"}
                          </td>
                        ))}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {candidate.validVotes}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600">
                          {candidate.abstainCount}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              
              {/* Mobile Cards - Shown only on small screens */}
              <div className="md:hidden">
                {loading ? (
                  <div className="p-4 text-center text-sm text-gray-500">
                    Memuat data...
                  </div>
                ) : sortedResults.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500">
                    Belum ada data hasil voting
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {sortedResults.map((candidate, index) => (
                      <div 
                        key={candidate.name} 
                        className={`p-4 ${index < 3 ? "bg-yellow-50" : ""}`}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-gray-900">#{index + 1}</span>
                          <span className="text-xs text-cyan-600 font-medium">{candidate.district}</span>
                        </div>
                        <div className="mb-2">
                          <button 
                            onClick={() => loadCandidateVoters(candidate.name, candidate.name)}
                            className="text-blue-600 hover:text-blue-800 hover:underline focus:outline-none text-base font-medium"
                          >
                            {candidate.name}
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500">Skor Total:</span>
                            <span className="ml-1 font-bold">{candidate.averageScore}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Vote Valid:</span>
                            <span className="ml-1">{candidate.validVotes}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Abstain:</span>
                            <span className="ml-1 text-orange-600">{candidate.abstainCount}</span>
                          </div>
                        </div>
                        <div className="mt-3 pt-2 border-t border-gray-100">
                          <p className="text-xs font-medium text-gray-500 mb-1">Detail Aspek:</p>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                            {aspects.map((aspect) => (
                              <div key={aspect.name}>
                                <span className="text-gray-500">{aspect.name}:</span>
                                <span className="ml-1">
                                  {candidate.aspectScores[aspect.name] === "0" || candidate.aspectScores[aspect.name] === 0 ? 
                                    "abstain" : candidate.aspectScores[aspect.name] || "N/A"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {results.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">
              Belum Ada Data Voting
            </h3>
            <p className="text-gray-600">
              Belum ada pemilih yang memberikan suara.
            </p>
          </div>
        )}
      </div>
      
      {/* Modal for displaying voters */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title={`Daftar Pemilih untuk ${selectedCandidate || ''}`}>
        {loadingVoters ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : candidateVoters.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Tidak ada data pemilih untuk kandidat ini
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Desktop Table - Hidden on small screens */}
            <table className="min-w-full divide-y divide-gray-200 hidden md:table">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Pemilih</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  {aspects.map((aspect) => (
                    <th key={aspect.name} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {aspect.name}
                    </th>
                  ))}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Waktu Vote</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {candidateVoters.map((voter, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{voter.voter_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{voter.voter_email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {voter.is_abstained || (voter.aspect_scores && Object.values(voter.aspect_scores).every(score => score === 0 || score === '0' || score === 'abstain')) ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Abstain</span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Valid</span>
                      )}
                    </td>
                    {aspects.map((aspect) => {
                      // Try to match aspect name case-insensitively
                      const aspectKey = voter.aspect_scores ? 
                        Object.keys(voter.aspect_scores).find(
                          key => key.toLowerCase() === aspect.name.toLowerCase()
                        ) : null;
                      
                      let score = 'N/A';
                      if (aspectKey && voter.aspect_scores) {
                        score = voter.aspect_scores[aspectKey];
                        // Jika nilai adalah 0, tampilkan sebagai "abstain"
                        if (score === 0 || score === '0') {
                          score = 'abstain';
                        }
                      }
                      
                      return (
                        <td key={aspect.name} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {score}
                        </td>
                      );
                    })}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(voter.updated_at).toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* Mobile Cards - Shown only on small screens */}
            <div className="md:hidden divide-y divide-gray-200">
              {candidateVoters.map((voter, index) => {
                // Determine if voter abstained
                const isAbstained = voter.is_abstained || 
                  (voter.aspect_scores && Object.values(voter.aspect_scores).every(
                    score => score === 0 || score === '0' || score === 'abstain'
                  ));
                
                return (
                  <div key={index} className="py-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="pr-2">
                        <div className="text-sm font-medium text-gray-900">{voter.voter_name}</div>
                        <div className="text-xs text-gray-500 truncate max-w-[200px]">{voter.voter_email}</div>
                      </div>
                      <div>
                        {isAbstained ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Abstain</span>
                        ) : (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Valid</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                      {aspects.map((aspect) => {
                        // Try to match aspect name case-insensitively
                        const aspectKey = voter.aspect_scores ? 
                          Object.keys(voter.aspect_scores).find(
                            key => key.toLowerCase() === aspect.name.toLowerCase()
                          ) : null;
                        
                        let score = 'N/A';
                        if (aspectKey && voter.aspect_scores) {
                          score = voter.aspect_scores[aspectKey];
                          // Jika nilai adalah 0, tampilkan sebagai "abstain"
                          if (score === 0 || score === '0') {
                            score = 'abstain';
                          }
                        }
                        
                        return (
                          <div key={aspect.name}>
                            <span className="text-gray-500">{aspect.name}:</span>
                            <span className="ml-1 text-gray-900">{score}</span>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="mt-2 text-xs text-gray-500">
                      Waktu: {new Date(voter.updated_at).toLocaleString('id-ID')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
