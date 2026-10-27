import type { Course, LeaderboardEntry } from "../types/domain";
export const leaderboard: Record<Course, LeaderboardEntry[]> = {
  GENERAL: [
    { name: "Ananya P.", band: 8.5, completed: 12 },
    { name: "Vikram S.", band: 8, completed: 10 },
    { name: "Priya N.", band: 8, completed: 9 },
    { name: "Rohan M.", band: 7.5, completed: 8 },
    { name: "Rahul S.", band: 7.5, completed: 3 },
  ],
  ACADEMIC: [
    { name: "Arjan S.", band: 8.5, completed: 11 },
    { name: "Tanvi K.", band: 8, completed: 8 },
    { name: "Priya P.", band: 7.5, completed: 3 },
    { name: "Sneha J.", band: 7.5, completed: 6 },
  ],
};
