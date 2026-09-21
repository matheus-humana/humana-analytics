export const askAiSuggestions = [
  "How many users did we have this week?",
  "Where did our visitors come from?",
  "Which pages got the most attention?",
  "How did this week compare to last week?",
] as const;

export const askAiDemoResponses: Record<string, string> = {
  "How many users did we have this week?":
    "You had 2,481 users over the last 7 days — about 12% higher than the previous week.",
  "Where did our visitors come from?":
    "Google was the largest traffic source over the selected period, followed by Direct and LinkedIn.",
  "Which pages got the most attention?":
    "The homepage led with 1,842 views, followed by /insights and /ebook.",
  "How did this week compare to last week?":
    "Traffic was stronger this week: users and sessions both rose, while engagement stayed broadly stable.",
};

export const askAiFallbackResponse =
  "This is a demo response. In a future release, Ask AI will answer using your connected analytics data.";
