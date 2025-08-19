import {
  createVoter,
  getVoter,
  saveVote,
  getVoterVotes,
  getAllVotes,
  saveVotingSession,
  getVotingSession,
  getVotingStatistics,
} from "../../lib/db";

export default async function handler(req, res) {
  const { method } = req;

  try {
    switch (method) {
      case "GET":
        await handleGet(req, res);
        break;
      case "POST":
        await handlePost(req, res);
        break;
      case "PUT":
        await handlePut(req, res);
        break;
      default:
        res.status(405).json({ message: "Method not allowed" });
    }
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
}

async function handleGet(req, res) {
  const { action, email, candidateId } = req.query;

  switch (action) {
    case "voter-votes":
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      const voterVotes = await getVoterVotes(email);
      const votingSession = await getVotingSession(email);
      res.status(200).json({ votes: voterVotes, session: votingSession });
      break;

    case "all-votes":
      const allVotes = await getAllVotes();
      res.status(200).json({ votes: allVotes });
      break;

    case "candidateVotes":
      if (!candidateId) {
        return res.status(400).json({ message: "Candidate ID is required" });
      }
      try {
        const votes = await getAllVotes();
        // Ensure votes is an array before filtering
        const votesArray = Array.isArray(votes) ? votes : [];
        const filteredVotes = votesArray.filter(
          (vote) => vote.candidate_id === candidateId
        );
        res.status(200).json(filteredVotes);
      } catch (error) {
        console.error("Error getting candidate votes:", error);
        res
          .status(500)
          .json({
            message: "Error getting candidate votes",
            error: error.message,
          });
      }
      break;

    case "candidateVoters":
      if (!candidateId) {
        return res.status(400).json({ message: "Candidate ID is required" });
      }
      try {
        const votes = await getAllVotes();
        // Ensure votes is an array before filtering
        const votesArray = Array.isArray(votes) ? votes : [];

        // Filter votes for this candidate
        const candidateVotes = votesArray.filter(
          (vote) => vote.candidate_id === candidateId
        );

        // Group votes by voter_email, keeping only the latest vote
        const latestVoterVotes = {};
        candidateVotes.forEach((vote) => {
          const key = vote.voter_email;
          if (
            !latestVoterVotes[key] ||
            new Date(vote.updated_at) >
              new Date(latestVoterVotes[key].updated_at)
          ) {
            latestVoterVotes[key] = vote;
          }
        });

        // Convert to array of unique voter votes
        const uniqueVoterVotes = Object.values(latestVoterVotes);

        // Get voter details for each vote
        const votersWithDetails = await Promise.all(
          uniqueVoterVotes.map(async (vote) => {
            const voter = await getVoter(vote.voter_email);
            return {
              ...vote,
              voter_name: voter ? voter.name : "Unknown",
            };
          })
        );

        res.status(200).json(votersWithDetails);
      } catch (error) {
        console.error("Error getting candidate voters:", error);
        res
          .status(500)
          .json({
            message: "Error getting candidate voters",
            error: error.message,
          });
      }
      break;

    case "statistics":
      const stats = await getVotingStatistics();
      res.status(200).json(stats);
      break;

    case "voter":
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      const voter = await getVoter(email);
      res.status(200).json({ voter });
      break;

    default:
      res.status(400).json({ message: "Invalid action" });
  }
}

async function handlePost(req, res) {
  const { action } = req.query;
  const { name, email, votes, sessionData } = req.body;

  switch (action) {
    case "create-voter":
      if (!name || !email) {
        return res.status(400).json({ message: "Name and email are required" });
      }
      const voter = await createVoter(name, email);
      res.status(201).json({ voter });
      break;

    case "submit-votes":
      if (!email || !votes || !sessionData) {
        return res.status(400).json({
          message: "Email, votes, and session data are required",
        });
      }

      // Save individual votes
      const savedVotes = [];
      for (const vote of votes) {
        const savedVote = await saveVote(
          email,
          vote.candidateId,
          vote.aspectScores,
          vote.isAbstained,
          vote.isPartial || false
        );
        savedVotes.push(savedVote);
      }

      // Save voting session
      const session = await saveVotingSession(email, sessionData);

      res.status(201).json({
        message: "Votes submitted successfully",
        votes: savedVotes,
        session,
      });
      break;

    default:
      res.status(400).json({ message: "Invalid action" });
  }
}

async function handlePut(req, res) {
  const { action } = req.query;
  const { email, votes, sessionData } = req.body;

  switch (action) {
    case "update-votes":
      if (!email || !votes || !sessionData) {
        return res.status(400).json({
          message: "Email, votes, and session data are required",
        });
      }

      // Update individual votes
      const updatedVotes = [];
      for (const vote of votes) {
        const updatedVote = await saveVote(
          email,
          vote.candidateId,
          vote.aspectScores,
          vote.isAbstained
        );
        updatedVotes.push(updatedVote);
      }

      // Update voting session
      const session = await saveVotingSession(email, sessionData);

      res.status(200).json({
        message: "Votes updated successfully",
        votes: updatedVotes,
        session,
      });
      break;

    default:
      res.status(400).json({ message: "Invalid action" });
  }
}
