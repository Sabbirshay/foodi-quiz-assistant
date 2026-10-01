import { z } from "zod";
export const quizSchema = z
  .object({
    question: z.string().trim().min(8, "Add a complete question.").max(4000),
    options: z
      .array(z.string().trim().min(1).max(1000))
      .min(2)
      .max(8)
      .refine(
        (v) => new Set(v.map((s) => s.toLowerCase())).size === v.length,
        "Each option must be different.",
      ),
    multiple: z.boolean().default(false),
    language: z.enum(["en", "bn"]).default("en"),
  })
  .strict();
export type QuizInput = z.infer<typeof quizSchema>;
export const settingsSchema = z
  .object({
    answer_model: z.string().max(150),
    crawler_model: z.string().max(150),
    cron_expression: z.string().min(9).max(100),
    timezone: z.string().min(1).max(80),
    schedule_enabled: z.boolean(),
    daily_budget_usd: z.number().min(0).max(1000),
    max_call_usd: z.number().min(0).max(10),
    max_pages: z.number().int().min(1).max(200),
    stale_hours: z.number().int().min(1).max(168),
  })
  .strict();
export type Settings = z.infer<typeof settingsSchema>;
export const defaultSettings: Settings = {
  answer_model: "",
  crawler_model: "",
  cron_expression: "0 */12 * * *",
  timezone: "Asia/Dhaka",
  schedule_enabled: false,
  daily_budget_usd: 0,
  max_call_usd: 0,
  max_pages: 100,
  stale_hours: 36,
};
export type Source = {
  id: string;
  title: string;
  url: string;
  content: string;
  checked_at: string;
  revision: string;
};
export const modelAnswerSchema = z
  .object({
    status: z.enum([
      "answered",
      "insufficient_evidence",
      "conflicting_sources",
      "clarification_needed",
    ]),
    selected: z.array(z.number().int().min(0).max(7)).max(8),
    explanation: z.string().min(1).max(5000),
    evidence: z
      .array(
        z
          .object({ source_id: z.string(), quote: z.string().min(1).max(2500) })
          .strict(),
      )
      .max(8),
  })
  .strict();
export type QuizAnswer = z.infer<typeof modelAnswerSchema> & {
  sources: Source[];
  model: string;
  demo?: boolean;
};
export type Member = {
  id: string;
  email: string;
  role: "employee" | "super_admin";
  active: boolean;
};
export type Model = {
  id: string;
  name: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
    request?: string;
    image?: string;
  };
  supported_parameters: string[];
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
};
export type Candidate = {
  id: string;
  url: string;
  title: string;
  content: string;
  previous_content: string | null;
  hash: string;
  status: string;
  created_at: string;
  coverage_notes: string[];
};
export const PORTAL_URL =
  "https://sites.google.com/view/foodi-service-guidelines/home";
export const SPREADSHEET_URL =
  "https://docs.google.com/spreadsheets/d/1iTDNOkkYqAjJGtvTPNSUOW_GNs6uMxJA8Vlu595mqDk/edit";
