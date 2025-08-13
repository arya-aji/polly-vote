import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { districts, aspects, getAllCandidates } from "../data/candidates";

export default function Voting() {
  const [voterData, setVoterData] = useState(null);
  const [votes, setVotes] = useState({});
  const [abstainedVotes, setAbstainedVotes] = useState(new Set()); // Changed to track per candidate per aspect
  const [currentAspectIndex, setCurrentAspectIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const router = useRouter();
  const candidates = getAllCandidates();

  useEffect(() => {
    const initializeVotingData = async () => {
      // Get voter data from localStorage
      const storedVoterData = localStorage.getItem("voterData");
      if (!storedVoterData) {
        router.push("/");
        return;
      }

      const userData = JSON.parse(storedVoterData);
      setVoterData(userData);

      try {
        // Load existing votes from database
        const response = await fetch(
          `/api/votes?action=voter-votes&email=${userData.email}`
        );
        if (response.ok) {
          const data = await response.json();

          // Convert database votes to local state format
          const votesMap = {};
          const abstainedSet = new Set();

          data.votes.forEach((vote) => {
            if (vote.is_abstained) {
              // For abstained candidates, mark all aspects as abstained
              aspects.forEach((aspect) => {
                abstainedSet.add(`${vote.candidate_id}_${aspect.name}`);
              });
            } else {
              votesMap[vote.candidate_id] = vote.aspect_scores;
            }
          });

          setVotes(votesMap);
          setAbstainedVotes(abstainedSet);
        } else {
          // Initialize empty votes if no existing votes found
          const initialVotes = {};
          candidates.forEach((candidate) => {
            initialVotes[candidate.name] = {};
            aspects.forEach((aspect) => {
              initialVotes[candidate.name][aspect.name] = undefined;
            });
          });
          setVotes(initialVotes);
        }
      } catch (error) {
        console.error("Error loading existing votes:", error);
        // Initialize empty votes if loading fails
        const initialVotes = {};
        candidates.forEach((candidate) => {
          initialVotes[candidate.name] = {};
          aspects.forEach((aspect) => {
            initialVotes[candidate.name][aspect.name] = undefined;
          });
        });
        setVotes(initialVotes);
      }
    };

    initializeVotingData();
  }, [router]);

  const handleVoteChange = (candidateName, aspectName, value) => {
    const abstainKey = `${candidateName}_${aspectName}`;
    const numValue = parseInt(value);

    setVotes((prev) => ({
      ...prev,
      [candidateName]: {
        ...prev[candidateName],
        [aspectName]: numValue,
      },
    }));

    // If value is 0, automatically set as abstain
    setAbstainedVotes((prev) => {
      const newSet = new Set(prev);
      if (numValue === 0) {
        newSet.add(abstainKey);
      } else {
        // Remove from abstained if voting with non-zero value
        newSet.delete(abstainKey);
      }
      return newSet;
    });
  };

  const handleAbstain = (candidateName, aspectName) => {
    const abstainKey = `${candidateName}_${aspectName}`;

    setAbstainedVotes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(abstainKey)) {
        newSet.delete(abstainKey);
      } else {
        newSet.add(abstainKey);
        // Clear vote for this candidate-aspect when abstaining
        setVotes((prevVotes) => {
          const newVotes = { ...prevVotes };
          if (newVotes[candidateName]) {
            newVotes[candidateName][aspectName] = 0;
          }
          return newVotes;
        });
      }
      return newSet;
    });
  };

  const handleBulkVoteChange = (aspectName, value) => {
    // Set same score for all candidates in current aspect
    const newVotes = { ...votes };
    candidates.forEach((candidate) => {
      const abstainKey = `${candidate.name}_${aspectName}`;
      if (!abstainedVotes.has(abstainKey)) {
        if (!newVotes[candidate.name]) {
          newVotes[candidate.name] = {};
        }
        newVotes[candidate.name][aspectName] = parseInt(value);
      }
    });
    setVotes(newVotes);
  };

  // Helper function to capitalize first letter of each word
  const capitalizeWords = (str) => {
    return str
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  const getCurrentAspect = () => aspects[currentAspectIndex];

  const isCurrentAspectComplete = () => {
    const currentAspect = getCurrentAspect();
    if (!currentAspect) return false;

    return candidates.every((candidate) => {
      const abstainKey = `${candidate.name}_${currentAspect.name}`;
      const vote = votes[candidate.name]?.[currentAspect.name];
      // Complete if abstained or has non-zero vote
      return abstainedVotes.has(abstainKey) || (vote !== undefined && vote > 0);
    });
  };

  const getCompletedAspectsCount = () => {
    return aspects.filter((aspect) => {
      return candidates.every((candidate) => {
        const abstainKey = `${candidate.name}_${aspect.name}`;
        const vote = votes[candidate.name]?.[aspect.name];
        return abstainedVotes.has(abstainKey) || (vote !== undefined && vote > 0);
      });
    }).length;
  };

  const isAllComplete = () => getCompletedAspectsCount() === aspects.length;

  const hasAnyVotes = () => {
    return candidates.some((candidate) => {
      return aspects.some((aspect) => {
        const abstainKey = `${candidate.name}_${aspect.name}`;
        const vote = votes[candidate.name]?.[aspect.name];
        return abstainedVotes.has(abstainKey) || (vote !== undefined && vote > 0);
      });
    });
  };

  const handleNext = () => {
    if (currentAspectIndex < aspects.length - 1) {
      setCurrentAspectIndex((prev) => prev + 1);
      // Scroll to top when moving to next aspect
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrevious = () => {
    if (currentAspectIndex > 0) {
      setCurrentAspectIndex((prev) => prev - 1);
      // Scroll to top when moving to previous aspect
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = async (isPartial = false) => {
    if (!isPartial && !isAllComplete()) {
      alert("Harap lengkapi penilaian untuk semua aspek sebelum mengirim.");
      return;
    }

    if (isPartial && !hasAnyVotes()) {
      alert("Harap berikan penilaian minimal untuk satu kandidat.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare votes data for submission
      const votesData = [];
      const sessionData = {
        voter_email: voterData.email,
        session_start: new Date().toISOString(),
        session_end: new Date().toISOString(),
        total_candidates: candidates.length,
        completed_candidates: candidates.length, // All candidates are processed in new flow
      };

      candidates.forEach((candidate) => {
        // Check if all aspects are abstained for this candidate
        const allAspectsAbstained = aspects.every((aspect) =>
          abstainedVotes.has(`${candidate.name}_${aspect.name}`)
        );

        if (allAspectsAbstained) {
          // Add abstained vote for entire candidate
          votesData.push({
            candidateId: candidate.name,
            aspectScores: {},
            isAbstained: true,
            isPartial: isPartial,
          });
        } else {
          // Add regular vote with scores (abstained aspects will have score 0)
          const aspectScores = {};
          aspects.forEach((aspect) => {
            const abstainKey = `${candidate.name}_${aspect.name}`;
            if (abstainedVotes.has(abstainKey)) {
              aspectScores[aspect.name] = 0; // Abstained aspects get 0
            } else {
              aspectScores[aspect.name] =
                votes[candidate.name]?.[aspect.name] || 0;
            }
          });

          votesData.push({
            candidateId: candidate.name,
            aspectScores: aspectScores,
            isAbstained: false,
            isPartial: isPartial,
          });
        }
      });

      // Submit to database
      const response = await fetch("/api/votes?action=submit-votes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: voterData.email,
          votes: votesData,
          sessionData: sessionData,
        }),
      });

      if (response.ok) {
        setShowSuccess(true);
        setTimeout(() => {
          router.push("/");
        }, 2000);
      } else {
        const errorData = await response.json();
        alert(`Gagal menyimpan suara: ${errorData.error}`);
      }
    } catch (error) {
      console.error("Error submitting votes:", error);
      alert("Terjadi kesalahan saat menyimpan suara. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!voterData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat data...</p>
        </div>
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-100 flex items-center justify-center">
        <div className="card text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Voting Berhasil!
          </h2>
          <p className="text-gray-600 mb-4">
            Terima kasih atas partisipasi Anda dalam pemilihan pegawai teladan.
          </p>
          <p className="text-sm text-gray-500">
            Anda akan diarahkan kembali ke halaman utama...
          </p>
        </div>
      </div>
    );
  }

  const currentAspect = getCurrentAspect();

  if (!currentAspect) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Aspek tidak ditemukan.</p>
        </div>
      </div>
    );
  }

  const progress = ((currentAspectIndex + 1) / aspects.length) * 100;
  const completedCount = getCompletedAspectsCount();

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">
            Voting Pegawai Teladan BPS
          </h1>
          <p className="text-gray-600">
            Pemilih: {voterData.name} ({voterData.email})
          </p>
        </div>

        {/* Progress */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">
              Aspek {currentAspectIndex + 1} dari {aspects.length}
            </span>
            <span className="text-sm text-gray-600">
              Selesai: {completedCount}/{aspects.length}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-cyan-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Sticky Aspect Header */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-200 mb-6">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-1">
                  {currentAspect.name}
                </h2>
                {currentAspect.description && (
                  <p className="text-lg text-cyan-600 font-medium">
                    {currentAspect.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-500">
                  Aspek selesai: {getCompletedAspectsCount()}/{aspects.length}
                </div>
                {/* Sticky Submit Sebagian Button */}
                <button
                  onClick={() => handleSubmit(true)}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium shadow-md"
                  disabled={!hasAnyVotes()}
                >
                  Submit Sebagian
                </button>
              </div>
            </div>

            {isCurrentAspectComplete() && (
              <div className="mt-2 flex items-center text-green-600">
                <svg
                  className="w-5 h-5 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-sm font-medium">
                  Aspek selesai dinilai
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Candidates List */}
        <div className="max-w-4xl mx-auto">
          <div className="card">
            <div className="space-y-4">
              {candidates.map((candidate) => {
                const abstainKey = `${candidate.name}_${currentAspect.name}`;
                const isAbstained = abstainedVotes.has(abstainKey);
                const currentVote =
                  votes[candidate.name]?.[currentAspect.name] || 0;

                return (
                  <div
                    key={candidate.name}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-gray-800">
                          {capitalizeWords(candidate.name)}
                        </h4>
                        <p className="text-sm text-gray-500">
                          Kecamatan {candidate.district}
                        </p>
                      </div>

                      {/* Abstain Button */}
                      <button
                        onClick={() =>
                          handleAbstain(candidate.name, currentAspect.name)
                        }
                        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                          isAbstained
                            ? "bg-orange-500 text-white hover:bg-orange-600"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                      >
                        {isAbstained ? "Batal Abstain" : "Abstain"}
                      </button>
                    </div>

                    {/* Voting Controls */}
                    {!isAbstained ? (
                      <div className="space-y-3">
                        {/* Slider Control */}
                        <div className="flex items-center space-x-4">
                          <span className="text-sm text-gray-500 w-8">0</span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={currentVote ?? 0}
                            onChange={(e) =>
                              handleVoteChange(
                                candidate.name,
                                currentAspect.name,
                                e.target.value
                              )
                            }
                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                          />
                          <span className="text-sm text-gray-500 w-8">100</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={currentVote ?? 0}
                            onChange={(e) =>
                              handleVoteChange(
                                candidate.name,
                                currentAspect.name,
                                e.target.value
                              )
                            }
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm"
                          />
                          {/* <span className="text-sm font-medium text-cyan-600 w-20">Nilai: {currentVote ?? 0}</span> */}
                        </div>

                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Sangat Kurang (0)</span>
                          <span>Sangat Baik (100)</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-2">
                        <span className="text-orange-600 text-sm font-medium">
                          ⚠️ Abstain
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={handlePrevious}
                disabled={currentAspectIndex === 0}
                className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Aspek Sebelumnya
              </button>

              <div className="text-sm text-gray-600">
                {isCurrentAspectComplete() ? (
                  <span className="text-green-600 font-medium">
                    ✓ Aspek Selesai
                  </span>
                ) : (
                  <span className="text-orange-600 font-medium">
                    Aspek Belum Selesai
                  </span>
                )}
              </div>

              <div className="flex space-x-3">
                {currentAspectIndex === aspects.length - 1 ? (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleSubmit(true)}
                      disabled={!hasAnyVotes() || isSubmitting}
                      className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? "Mengirim..." : "Submit Sebagian"}
                    </button>
                    <button
                      onClick={() => handleSubmit(false)}
                      disabled={!isAllComplete() || isSubmitting}
                      className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? "Mengirim..." : "Kirim Lengkap"}
                    </button>
                  </div>
                ) : (
                  <button onClick={handleNext} className="btn-primary">
                    Aspek Selanjutnya →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        {hasAnyVotes() && (
          <div className="card mt-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              Ringkasan Penilaian
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {candidates.map((candidate) => {
                const candidateVotes = votes[candidate.name] || {};
                let totalScore = 0;
                let validAspects = 0;

                aspects.forEach((aspect) => {
                  const abstainKey = `${candidate.name}_${aspect.name}`;
                  const vote = candidateVotes[aspect.name];
                  if (
                    !abstainedVotes.has(abstainKey) &&
                    vote !== undefined &&
                    vote > 0
                  ) {
                    totalScore += vote;
                    validAspects++;
                  }
                });

                const avgScore =
                  validAspects > 0 ? totalScore / validAspects : 0;

                return (
                  <div
                    key={candidate.name}
                    className="border border-gray-200 rounded-lg p-3"
                  >
                    <h4 className="font-medium text-gray-800 mb-1">
                      {capitalizeWords(candidate.name)}
                    </h4>
                    <p className="text-xs text-gray-500 mb-2">
                      Kecamatan {candidate.district}
                    </p>
                    <div>
                      <p className="text-sm text-gray-600">
                        Rata-rata: {avgScore.toFixed(1)}
                      </p>
                      <div className="text-xs text-gray-500 mt-1">
                        {aspects.map((aspect) => {
                          const abstainKey = `${candidate.name}_${aspect.name}`;
                          const isAbstained = abstainedVotes.has(abstainKey);
                          return (
                            <div
                              key={aspect.name}
                              className="flex justify-between"
                            >
                              <span>{aspect.name}:</span>
                              <span>
                                {isAbstained || candidateVotes[aspect.name] === 0
                                  ? "Abstain"
                                  : candidateVotes[aspect.name] !== undefined && candidateVotes[aspect.name] > 0
                                  ? candidateVotes[aspect.name]
                                  : "-"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
