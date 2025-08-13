import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

// Load environment variables
config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined in environment variables');
}

// Initialize Neon connection
const sql = neon(process.env.DATABASE_URL);

// Database initialization function
export async function initializeDatabase() {
  try {
    // Create voters table
    await sql`
      CREATE TABLE IF NOT EXISTS voters (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create votes table
    await sql`
      CREATE TABLE IF NOT EXISTS votes (
        id SERIAL PRIMARY KEY,
        voter_email VARCHAR(255) NOT NULL,
        candidate_id VARCHAR(100) NOT NULL,
        aspect_scores JSONB NOT NULL,
        is_abstained BOOLEAN DEFAULT FALSE,
        is_partial BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (voter_email) REFERENCES voters(email) ON DELETE CASCADE,
        UNIQUE(voter_email, candidate_id)
      )
    `;

    // Create voting_sessions table
    await sql`
      CREATE TABLE IF NOT EXISTS voting_sessions (
        id SERIAL PRIMARY KEY,
        voter_email VARCHAR(255) NOT NULL,
        is_complete BOOLEAN DEFAULT FALSE,
        abstained_candidates JSONB DEFAULT '[]',
        total_candidates INTEGER DEFAULT 0,
        completed_candidates INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (voter_email) REFERENCES voters(email) ON DELETE CASCADE,
        UNIQUE(voter_email)
      )
    `;

    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Voter operations
export async function createVoter(name, email) {
  try {
    const result = await sql`
      INSERT INTO voters (name, email)
      VALUES (${name}, ${email})
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    return result[0];
  } catch (error) {
    console.error('Error creating voter:', error);
    throw error;
  }
}

export async function getVoter(email) {
  try {
    const result = await sql`
      SELECT * FROM voters WHERE email = ${email}
    `;
    return result[0] || null;
  } catch (error) {
    console.error('Error getting voter:', error);
    throw error;
  }
}

// Vote operations
export async function saveVote(voterEmail, candidateId, aspectScores, isAbstained = false, isPartial = false) {
  try {
    const result = await sql`
      INSERT INTO votes (voter_email, candidate_id, aspect_scores, is_abstained, is_partial)
      VALUES (${voterEmail}, ${candidateId}, ${JSON.stringify(aspectScores)}, ${isAbstained}, ${isPartial})
      ON CONFLICT (voter_email, candidate_id) DO UPDATE SET
        aspect_scores = EXCLUDED.aspect_scores,
        is_abstained = EXCLUDED.is_abstained,
        is_partial = EXCLUDED.is_partial,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    return result[0];
  } catch (error) {
    console.error('Error saving vote:', error);
    throw error;
  }
}

export async function getVoterVotes(voterEmail) {
  try {
    const result = await sql`
      SELECT * FROM votes WHERE voter_email = ${voterEmail}
    `;
    return result;
  } catch (error) {
    console.error('Error getting voter votes:', error);
    throw error;
  }
}

export async function getAllVotes() {
  try {
    const result = await sql`
      SELECT * FROM votes
    `;
    return result;
  } catch (error) {
    console.error('Error getting all votes:', error);
    throw error;
  }
}

// Voting session operations
export async function saveVotingSession(voterEmail, sessionData) {
  try {
    const {
      isComplete,
      abstainedCandidates,
      totalCandidates,
      completedCandidates,
      isPartial
    } = sessionData;

    const result = await sql`
      INSERT INTO voting_sessions (
        voter_email, is_complete, abstained_candidates, 
        total_candidates, completed_candidates
      )
      VALUES (
        ${voterEmail}, ${isComplete}, ${JSON.stringify(abstainedCandidates)},
        ${totalCandidates}, ${completedCandidates}
      )
      ON CONFLICT (voter_email) DO UPDATE SET
        is_complete = EXCLUDED.is_complete,
        abstained_candidates = EXCLUDED.abstained_candidates,
        total_candidates = EXCLUDED.total_candidates,
        completed_candidates = EXCLUDED.completed_candidates,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    // Update is_partial flag for all votes in this session
    await sql`
      UPDATE votes 
      SET is_partial = ${isPartial}
      WHERE voter_email = ${voterEmail}
    `;

    return result[0];
  } catch (error) {
    console.error('Error saving voting session:', error);
    throw error;
  }
}

export async function getVotingSession(voterEmail) {
  try {
    const result = await sql`
      SELECT * FROM voting_sessions WHERE voter_email = ${voterEmail}
    `;
    return result[0] || null;
  } catch (error) {
    console.error('Error getting voting session:', error);
    throw error;
  }
}

// Statistics operations
export async function getVotingStatistics() {
  try {
    // Get all votes
    const allVotes = await getAllVotes();
    
    if (allVotes.length === 0) {
      return {
        totalVoters: 0,
        completeVotes: 0,
        partialVotes: 0,
        candidateStats: []
      };
    }
    
    // Group votes by voter_email and candidate_id, keeping only the latest submission
    const latestVotes = {};
    
    allVotes.forEach(vote => {
      const key = `${vote.voter_email}_${vote.candidate_id}`;
      if (!latestVotes[key] || new Date(vote.updated_at) > new Date(latestVotes[key].updated_at)) {
        latestVotes[key] = vote;
      }
    });
    
    const validVotes = Object.values(latestVotes);
    
    // Count unique voters
    const uniqueVoters = new Set(validVotes.map(vote => vote.voter_email));
    const totalVoters = uniqueVoters.size;
    
    // Group votes by candidate for statistics
    const candidateStats = {};
    
    validVotes.forEach(vote => {
      if (!candidateStats[vote.candidate_id]) {
        candidateStats[vote.candidate_id] = {
          candidate_id: vote.candidate_id,
          total_votes: 0,
          valid_votes: 0,
          abstained_votes: 0,
          scores: []
        };
      }
      
      candidateStats[vote.candidate_id].total_votes++;
      
      if (vote.is_abstained) {
        candidateStats[vote.candidate_id].abstained_votes++;
      } else {
        candidateStats[vote.candidate_id].valid_votes++;
        
        // Calculate weighted score based on aspects from data/candidates.js
        const aspectScores = vote.aspect_scores;
        if (aspectScores && typeof aspectScores === 'object') {
          // Use hardcoded aspects instead of dynamic import
          const aspects = [
            { name: 'Kejujuran', weight: 15 },
            { name: 'Loyalitas', weight: 15 },
            { name: 'Penyelesaian pekerjaan', weight: 15 },
            { name: 'Kualitas pekerjaan', weight: 15 },
            { name: 'Kerjasama', weight: 10 },
            { name: 'Pengembangan diri', weight: 10 },
            { name: 'Komunikasi', weight: 10 },
            { name: 'Percaya diri', weight: 10 }
          ];
          
          let score = 0;
          // Calculate weighted score using the correct aspect names and weights
          aspects.forEach(aspect => {
            // Try to match aspect name case-insensitively
            const aspectKey = Object.keys(aspectScores).find(
              key => key.toLowerCase() === aspect.name.toLowerCase()
            );
            
            if (aspectKey) {
              // Add weighted score: value * (weight/100)
              score += (parseFloat(aspectScores[aspectKey]) || 0) * (aspect.weight / 100);
            }
          });
          
          if (score > 0) { // Only include non-zero scores
            candidateStats[vote.candidate_id].scores.push(score);
          }
        }
      }
    });
    
    // Calculate total weighted scores (not average) and sort by score
    const candidateStatsResult = Object.values(candidateStats)
      .map(stat => ({
        ...stat,
        average_score: stat.scores.length > 0 
          ? stat.scores.reduce((a, b) => a + b, 0) 
          : null
      }))
      .sort((a, b) => (b.average_score || 0) - (a.average_score || 0));
    
    // Get session statistics
    let completeVotes = 0;
    let partialVotes = 0;
    
    try {
      const sessions = await sql`SELECT * FROM voting_sessions`;
      completeVotes = sessions.filter(s => s.is_complete).length;
      partialVotes = sessions.filter(s => !s.is_complete).length;
    } catch (sessionError) {
      console.log('No voting sessions found or error accessing sessions');
    }
    
    return {
      totalVoters,
      completeVotes,
      partialVotes,
      candidateStats: candidateStatsResult
    };
  } catch (error) {
    console.error('Error getting voting statistics:', error);
    return {
      totalVoters: 0,
      completeVotes: 0,
      partialVotes: 0,
      candidateStats: []
    };
  }
}

export { sql };