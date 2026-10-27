import type { Progress, Skill } from "../types/domain";
export const skills: Skill[] = ["Listening", "Reading", "Writing", "Speaking"];
export const progress: Progress[] = [
  {
    skill: "Listening",
    percent: 82,
    completed: 34,
    total: 40,
    band: 7.5,
    description: "Conversations, details & listening for meaning",
  },
  {
    skill: "Reading",
    percent: 75,
    completed: 30,
    total: 40,
    band: 7,
    description: "Passages, matching & finding information",
  },
  {
    skill: "Writing",
    percent: 62,
    completed: 25,
    total: 40,
    band: 6.5,
    description: "Task 1 & Task 2 writing practice",
  },
  {
    skill: "Speaking",
    percent: 80,
    completed: 32,
    total: 40,
    band: 7.5,
    description: "Parts 1–3, cue cards & speaking preparation",
  },
];
export const passages = {
  GENERAL: {
    title: "Public Transportation Guidelines & Fare Policy in Metro City",
    paragraphs: [
      [
        "Contactless Smart Card Regulations & Peak Hour Fares",
        "Metro City Transit operates a fully integrated contactless fare system. Passengers must tap their card at both entry and exit. Morning peak tariffs apply on weekdays between 07:30 and 09:30. Folded bicycles are permitted at all hours when they remain folded throughout the journey.",
      ],
      [
        "Concession Passes & Student Discounts",
        "Higher education concession cards provide a 50% reduction for full-time students enrolled for at least six consecutive months. Short courses under three months are not eligible. Concession holders must renew their enrollment evidence annually.",
      ],
      [
        "Luggage, Bicycles and Pet Travel",
        "Luggage must not block doors or corridors. Non-folding bicycles are prohibited during morning rush hours. Small animals must travel in an approved carrier. Assistance dogs are exempt from this requirement.",
      ],
      [
        "Lost Property & Refund Procedures",
        "Overcharge claims must be submitted within fourteen business days. Lost items are held for thirty days. Owners must show photo identification when collecting their belongings.",
      ],
    ],
  },
  ACADEMIC: {
    title: "Cities, transport and the changing urban landscape",
    paragraphs: [
      [
        "A connected city",
        "Urban transport systems shape the movement of people and the use of public space. Integrated ticketing can reduce friction between different modes of travel. Researchers increasingly examine accessibility alongside journey time.",
      ],
      [
        "The role of public space",
        "Compact neighborhoods encourage walking when services are within reach. However, proximity alone does not guarantee access: road safety, lighting and the quality of pavements also influence travel choices.",
      ],
      [
        "Planning for change",
        "Long-term investment needs to account for changing populations. Flexible transport networks can respond to new demand without requiring every journey to pass through the city center.",
      ],
    ],
  },
};
export const writingPrompts = {
  GENERAL: [
    "You recently stayed at a hotel and left a laptop charger and a folder in the conference room. Write to the manager. Describe the items, explain why they matter, and ask how they can be returned.",
    "Some people believe that taking a gap year before university gives young people valuable experience. Others believe it interrupts their education. Discuss both views and give your opinion.",
  ],
  ACADEMIC: [
    "Summarise this illustrative transport dataset: bus use rose from 30% to 40%, cycling from 10% to 25%, and car use fell from 60% to 35% between 2010 and 2025. Select and compare the main features.",
    "Some people believe cities should invest more in public transport than in building roads. To what extent do you agree or disagree?",
  ],
};
export const speakingPrompts = [
  "Tell us about your hometown. What do you enjoy about living there?",
  "Describe a memorable journey you took by public transport. Say where you went, who you travelled with, what happened, and why you remember it.",
  "How might public transport change in the future? What can cities do to encourage people to use it?",
];
