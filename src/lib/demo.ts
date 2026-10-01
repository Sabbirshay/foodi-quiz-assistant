import type { QuizAnswer, QuizInput } from "./contracts";
export const demoQuestion: QuizInput = {
  question:
    "In this training example, what should an employee do when two knowledge sources give conflicting instructions?",
  options: [
    "Choose the newest-looking page",
    "Ask the policy owner to clarify the conflict",
    "Combine both instructions",
    "Select an answer without checking",
  ],
  multiple: false,
  language: "en",
};
export const demoAnswer: QuizAnswer = {
  status: "answered",
  selected: [1],
  explanation:
    "The training guide says to ask the policy owner when approved sources conflict. The assistant should not guess which instruction takes precedence.",
  evidence: [
    {
      source_id: "training-example",
      quote:
        "When two approved sources conflict, ask the policy owner to clarify before choosing an answer.",
    },
  ],
  sources: [
    {
      id: "training-example",
      title: "Synthetic training guide — example only",
      url: "",
      content:
        "When two approved sources conflict, ask the policy owner to clarify before choosing an answer.",
      checked_at: "",
      revision: "synthetic",
    },
  ],
  model: "Demonstration — no AI call",
  demo: true,
};
