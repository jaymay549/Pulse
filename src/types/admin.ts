// ── Queue Types ──

export type QueueStatus = "pending" | "processing" | "processed" | "failed";

export interface QueueItemMention {
  vendor_name: string;
  category: string;
  headline: string;
  dimension: string;
  sentiment: string;
  snippet_anon: string;
  message_ids: number[];
  reasoning?: string;
  approved_mention_id?: number | null;
}

export interface QueueItemAIResponse {
  mentions: QueueItemMention[];
  thinking?: string;
}

export interface VendorQueueItem {
  id: number;
  conversation_chunk: string;
  ai_response: string | null;
  status: QueueStatus;
  group_id: number | null;
  group_name: string | null;
  message_count: number | null;
  created_at: string;
  conversation_start_time: string | null;
  conversation_end_time: string | null;
  processor_version: string | null;
}

export interface ApprovedMention {
  id: number;
  vendor_name: string;
  category: string | null;
  headline: string | null;
  dimension: string;
  sentiment: string;
  snippet_anon: string;
  message_ids: unknown;
  approved_at: string | null;
}

export interface VendorIgnore {
  id: number;
  pattern: string;
  reason: string | null;
  category: string | null;
  created_at: string;
}

// ── Topic Types ──

export type TopicStatus = "active" | "archived" | "merged" | "rejected";

export interface Topic {
  id: string;
  title: string;
  theme: string | null;
  insight: string | null;
  actionable_insight: string | null;
  category: string | null;
  current_sentiment: string | null;
  message_count: number;
  group_count: number;
  trending_score: number;
  score_breakdown: Record<string, number> | null;
  first_seen_at: string | null;
  last_updated_at: string | null;
  last_message_at: string | null;
  processing_count: number;
  is_pinned: boolean;
  is_archived: boolean;
  status: TopicStatus;
  created_by: string | null;
}

export interface TopicVote {
  id: number;
  topic_id: string;
  phone_number: string;
  vote_type: "upvote" | "downvote";
  user_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface TopicSentimentHistory {
  id: number;
  topic_id: string;
  sentiment: string;
  message_count: number;
  recorded_at: string;
  period_start: string | null;
  period_end: string | null;
}

// ── Group Types ──

export interface WhatsAppGroup {
  id: number;
  whatsapp_id: string;
  name: string;
  is_monitored: boolean;
  is_favorite: boolean;
  created_at: string;
  message_count?: number;
  last_message_at?: string | null;
}

export interface GroupMessage {
  id: number;
  group_id: number;
  sender: string;
  sender_number: string | null;
  content: string;
  timestamp: string;
  status: string | null;
}

export interface GroupView {
  id: number;
  name: string;
  description: string | null;
  filter_config: Record<string, unknown>;
  order_index: number;
  is_system: boolean;
  created_at: string;
}

// ── Task Types ──

export type TaskStatus =
  | "pending"
  | "generating"
  | "ready"
  | "sending"
  | "sent"
  | "failed"
  | "rejected"
  | "cancelled";

export interface TaskDefinition {
  id: number;
  name: string;
  group_ids: number[];
  group_names: string[];
  recipient_group_ids: number[] | null;
  recipient_group_names: string[] | null;
  prompt: string;
  timeframe: string;
  custom_start_date: string | null;
  custom_end_date: string | null;
  pdf_mode: string | null;
  admin_phone: string | null;
  notify_admin: boolean;
  repeat_type: string | null;
  pdf_filename_template: string | null;
  is_archived: boolean;
  created_at: string;
  task_occurrences?: TaskOccurrence[];
}

export interface TaskOccurrence {
  id: number;
  task_definition_id: number;
  generate_at: string;
  send_at: string;
  status: TaskStatus;
  pdf_ids: number[] | null;
  error: string | null;
  edited_html: string | null;
  created_at: string;
  completed_at: string | null;
}

// ── Prompt Types ──

export interface SummaryPrompt {
  id: number;
  timeframe: string;
  prompt: string;
  version: number;
  is_active: boolean;
  created_at: string;
}

export type PromptTimeframe = "last1day" | "last7days" | "all" | "custom";

// ── Vendor Group/Alias Types ──

export interface VendorGroup {
  id: number;
  canonical_name: string;
  created_at: string;
  updated_at: string;
}

export interface VendorAlias {
  id: number;
  group_id: number;
  alias: string;
  created_at: string;
}

export interface VendorMetadata {
  id: number;
  vendor_name: string;
  website_url: string | null;
  logo_url: string | null;
  description: string | null;
  category: string | null;
  enrichment_status: string | null;
  enrichment_error: string | null;
  enriched_at: string | null;
  created_at: string;
  updated_at: string;
  linkedin_url: string | null;
  banner_url: string | null;
  tagline: string | null;
  headquarters: string | null;
}

// ── Dimension/Category Constants ──

export const VENDOR_DIMENSIONS: Record<string, { label: string; icon: string }> = {
  worth_it: { label: "Worth It", icon: "DollarSign" },
  reliable: { label: "Reliable", icon: "Shield" },
  integrates: { label: "Integrates", icon: "Puzzle" },
  support: { label: "Support", icon: "Headphones" },
  adopted: { label: "Adopted", icon: "Users" },
  other: { label: "Other", icon: "MoreHorizontal" },
};

export const SENTIMENT_COLORS: Record<string, string> = {
  positive: "text-green-600 bg-green-50 border-green-200",
  negative: "text-red-600 bg-red-50 border-red-200",
  neutral: "text-gray-600 bg-gray-50 border-gray-200",
  mixed: "text-amber-600 bg-amber-50 border-amber-200",
  unknown: "text-gray-400 bg-gray-50 border-gray-200",
  promoter: "text-emerald-700 bg-emerald-50 border-emerald-200",
  passive: "text-slate-600 bg-slate-50 border-slate-200",
  detractor: "text-rose-700 bg-rose-50 border-rose-200",
};

// ── AI Chat Types ──

export interface ChatMessage {
  type: "message";
  role: "user" | "assistant";
  content: string;
  pdfId?: number | null;
  pdfStatus?: "generating" | "success" | "error";
  pdfError?: string;
  error?: string;
  retryCount?: number;
  canRetry?: boolean;
}

export interface PdfAction {
  type: "pdf_action";
  id: number | null;
  title: string;
  status: "generating" | "success" | "error";
  createdAt: string;
  groupNames: string[];
  error?: string;
}

export type ChatItem = ChatMessage | PdfAction;

export type DateRangePreset = "last7days" | "last1day" | "all" | "custom";

export interface PdfExport {
  id: number;
  filename: string;
  title: string;
  group_ids: number[];
  group_names: string[];
  file_size: number;
  created_at: string;
  sent_to_groups: { groupId: number; groupName: string }[] | null;
}

export interface ChatConversation {
  id: number;
  title: string;
  group_ids: number[];
  group_names: string[];
  context_group_ids: number[];
  messages: { role: string; content: string }[];
  date_range_preset: string;
  custom_start_date: string | null;
  custom_end_date: string | null;
  pdf_ids: number[];
  created_at: string;
  updated_at: string;
}

// ── Scheduled Message Types ──

export interface ScheduledMessage {
  id: number;
  group_ids: number[];
  group_names: string[];
  message: string;
  scheduled_for: string;
  status: "pending" | "sent" | "failed";
  pdf_id?: number;
  created_at: string;
}

// ── Trend Types ──

export interface TrendReport {
  id: number;
  report_type: "daily" | "weekly";
  date_range_start: string;
  date_range_end: string;
  overall_sentiment: string;
  topics: TrendTopic[];
  created_at: string;
}

export interface TrendTopic {
  id?: string;
  title: string;
  category: string;
  sentiment: string;
  summary: string;
  actionItems?: string[];
  vendors?: string[];
}

// ── Member Types ──

export interface MemberActivity {
  date: string;
  count: number;
}

export interface MemberGroup {
  id: number;
  name: string;
  messageCount: number;
  lastMessageTime: string | null;
  isMonitored: boolean;
}

export interface Member {
  sender: string;
  sender_number: string | null;
  groupCount: number;
  totalMessageCount: number;
  lastMessageTime: string | null;
  dailyActivity: MemberActivity[];
  groups: MemberGroup[];
}
