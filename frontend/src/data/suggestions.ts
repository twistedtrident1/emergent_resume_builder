// Curated ADHD-friendly task suggestions, grouped by typical-day moments.
// Keep titles short and concrete — easier to scan when your mind is racing.

export type SuggestionCategory = {
  key: string;
  label: string;
  icon: string; // Ionicons glyph name
  suggestions: string[];
};

export const SUGGESTION_CATEGORIES: SuggestionCategory[] = [
  {
    key: "morning",
    label: "Morning",
    icon: "sunny-outline",
    suggestions: [
      "Drink a glass of water",
      "Take morning medication",
      "Brush teeth",
      "Wash face",
      "Make the bed",
      "Get dressed",
      "Eat breakfast",
      "Open the curtains",
      "Take vitamins",
      "Stretch for 2 minutes",
    ],
  },
  {
    key: "self-care",
    label: "Self-care",
    icon: "heart-outline",
    suggestions: [
      "Shower",
      "Skincare routine",
      "10-minute walk outside",
      "Move body for 15 min",
      "Drink water (mid-day)",
      "Eat a real meal",
      "Take a 5-minute break",
      "Step outside for fresh air",
      "Take afternoon medication",
    ],
  },
  {
    key: "home",
    label: "Home",
    icon: "home-outline",
    suggestions: [
      "Tidy one surface",
      "Wash the dishes",
      "Load the laundry",
      "Take out the trash",
      "Water the plants",
      "Make tomorrow's lunch",
      "Empty the dishwasher",
      "Sweep one room",
      "Sort the mail",
    ],
  },
  {
    key: "mind",
    label: "Mind",
    icon: "book-outline",
    suggestions: [
      "Read for 10 minutes",
      "Journal one line",
      "Write 3 things you're grateful for",
      "Meditate for 5 minutes",
      "Phone away for 30 min",
      "Do a grounding exercise",
      "Plan tomorrow's top 3",
    ],
  },
  {
    key: "connection",
    label: "Connection",
    icon: "people-outline",
    suggestions: [
      "Text someone you love",
      "Call a friend or family",
      "Hug a pet (or person)",
      "Say thank you to someone",
      "Send one kind message",
    ],
  },
  {
    key: "evening",
    label: "Evening",
    icon: "moon-outline",
    suggestions: [
      "Set out clothes for tomorrow",
      "No screens 30 min before bed",
      "Take evening medication",
      "Brush teeth",
      "Skincare routine",
      "Read in bed",
      "Lights out by 11 pm",
      "Plug in the phone away from bed",
    ],
  },
];
