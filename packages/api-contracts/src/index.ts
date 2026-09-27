import { z } from "zod";
import { LETTER_BODY_MAX_LENGTH, LETTER_TEMPLATE_CODES } from "./letters";
import { SHOP_LANDMARK_IDS, SHOP_REVIEW_TAGS } from "./shop-island";

export * from "./letters";
export * from "./shop-island";

export * from "./telemetry";

export const IdSchema = z.string().min(1).max(128);
export const TimestampSchema = z.string().datetime({ offset: true });

export const JobPostingStatusSchema = z.enum(["draft", "published", "closed"]);
export const ApplicationStatusSchema = z.enum([
  "applied",
  "selected",
  "rejected",
  "withdrawn",
]);
export const ShiftStatusSchema = z.enum([
  "scheduled",
  "checked_in",
  "checked_out",
  "completed",
  "no_show",
  "disputed",
  "cancelled",
]);

export const MemberRoleSchema = z.enum(["manager", "staff"]);

/** A person who works at the organization and uses the business app. */
export const MemberSchema = z.object({
  id: IdSchema,
  organizationId: IdSchema,
  displayName: z.string().min(1).max(80),
  role: MemberRoleSchema,
});

const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const StoreSchema = z.object({
  id: IdSchema,
  organizationId: IdSchema,
  name: z.string().min(1).max(120),
  timezone: z.string().min(1),
  /** The company logo on the island's signboard: a URL or a small data URL. */
  logoUrl: z.string().max(400_000).nullable(),
  /** The shop's colors on its island: signboard and awning stripes. */
  signColor: HexColorSchema,
  accentColor: HexColorSchema,
  /** "In their words": the one line the shop stands for. */
  values: z.string().max(80),
});

/** What a shop may change about its island: looks only, never the landmarks. */
export const UpdateStoreInputSchema = StoreSchema.pick({
  logoUrl: true,
  signColor: true,
  accentColor: true,
  values: true,
}).partial();

export const BreakRuleSchema = z.object({
  /** Applies once worked time exceeds this many minutes. */
  workedOverMinutes: z.number().int().nonnegative(),
  requiredBreakMinutes: z.number().int().nonnegative(),
});

/** Labor rules a store applies when it summarizes attendance. */
export const StoreSettingsSchema = z.object({
  storeId: IdSchema,
  breakRules: z.array(BreakRuleSchema).max(5),
  /** Premium on time beyond the legal daily hours, e.g. 0.25. */
  overtimePremiumRate: z.number().min(0).max(1),
  /** Premium on 22:00–05:00 work, e.g. 0.25. */
  nightPremiumRate: z.number().min(0).max(1),
  /** Worked minutes are rounded down to this unit. */
  roundingMinutes: z.union([z.literal(1), z.literal(5), z.literal(10), z.literal(15), z.literal(30)]),
  /** Day of month the period closes on; 0 means the last day. */
  closingDay: z.number().int().min(0).max(28),
});

export const UpdateStoreSettingsInputSchema = StoreSettingsSchema.omit({ storeId: true });

export const JobRoleSchema = z.enum(["register", "dish", "hall", "kitchen", "stock", "other"]);

export const JobPostingSchema = z.object({
  id: IdSchema,
  organizationId: IdSchema,
  storeId: IdSchema,
  title: z.string().min(1).max(120),
  description: z.string().max(5000),
  role: JobRoleSchema,
  hourlyWage: z.number().int().nonnegative(),
  startsAt: TimestampSchema,
  endsAt: TimestampSchema,
  capacity: z.number().int().positive().max(1000),
  status: JobPostingStatusSchema,
  /** Posted to fill a sudden gap; shown first to past workers. */
  urgent: z.boolean(),
  publishedAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
});

export const CreateJobPostingInputSchema = JobPostingSchema.omit({
  id: true,
  organizationId: true,
  urgent: true,
  publishedAt: true,
  createdAt: true,
}).extend({ urgent: z.boolean().optional() });

/** Asks a worker who has worked here before to take a job, usually an urgent one. */
export const InvitationSchema = z.object({
  id: IdSchema,
  organizationId: IdSchema,
  jobPostingId: IdSchema,
  workerId: IdSchema,
  workerDisplayName: z.string().min(1).max(80),
  status: z.enum(["sent", "accepted", "declined"]),
  sentAt: TimestampSchema,
  respondedAt: TimestampSchema.nullable(),
});

export const CreateInvitationInputSchema = z.object({
  jobPostingId: IdSchema,
  workerId: IdSchema,
});

export const RespondInvitationInputSchema = z.object({
  response: z.enum(["accepted", "declined"]),
});

/** A month whose attendance is locked; punches and corrections in it are refused. */
export const ClosedPeriodSchema = z.object({
  id: IdSchema,
  organizationId: IdSchema,
  storeId: IdSchema,
  /** YYYY-MM in the store's time zone. */
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  closedAt: TimestampSchema,
  closedBy: IdSchema,
});

export const ClosePeriodInputSchema = ClosedPeriodSchema.pick({ storeId: true, month: true });

export const ApplicationSchema = z.object({
  id: IdSchema,
  organizationId: IdSchema,
  jobPostingId: IdSchema,
  workerId: IdSchema,
  workerDisplayName: z.string().min(1).max(80),
  status: ApplicationStatusSchema,
  appliedAt: TimestampSchema,
  decidedAt: TimestampSchema.nullable(),
  decisionNote: z.string().max(1000).nullable(),
});

export const CreateApplicationInputSchema = z.object({
  jobPostingId: IdSchema,
  workerDisplayName: z.string().min(1).max(80),
});

export const ApplicationDecisionInputSchema = z.object({
  decision: z.enum(["selected", "rejected"]),
  note: z.string().max(1000).optional(),
});

export const ShiftSchema = z.object({
  id: IdSchema,
  organizationId: IdSchema,
  storeId: IdSchema,
  jobPostingId: IdSchema,
  applicationId: IdSchema,
  workerId: IdSchema,
  scheduledStartAt: TimestampSchema,
  scheduledEndAt: TimestampSchema,
  status: ShiftStatusSchema,
});

export const AttendanceEventKindSchema = z.enum(["check_in", "check_out", "break_start", "break_end"]);

export const AttendanceEventSchema = z.object({
  id: IdSchema,
  organizationId: IdSchema,
  shiftId: IdSchema,
  kind: AttendanceEventKindSchema,
  recordedAt: TimestampSchema,
  source: z.enum(["worker", "employer", "system"]),
  actorId: IdSchema,
  clientRequestId: IdSchema,
  /** Set when this event corrects an earlier one; the earlier one then no longer counts. */
  correctionOfEventId: IdSchema.nullable(),
  /** The reason given for a correction. */
  note: z.string().max(500).nullable(),
});

export const CorrectAttendanceInputSchema = z.object({
  eventId: IdSchema,
  recordedAt: TimestampSchema,
  reason: z.string().min(1).max(500),
  clientRequestId: IdSchema,
});

export const RecordAttendanceInputSchema = AttendanceEventSchema.pick({
  kind: true,
  recordedAt: true,
  clientRequestId: true,
});

export const AttendanceSummarySchema = z.object({
  shiftId: IdSchema,
  scheduledStartAt: TimestampSchema,
  scheduledEndAt: TimestampSchema,
  actualCheckInAt: TimestampSchema.nullable(),
  actualCheckOutAt: TimestampSchema.nullable(),
  punctuality: z.enum(["pending", "on_time", "late"]),
  minutesLate: z.number().int().nonnegative(),
  scheduledMinutes: z.number().int().nonnegative(),
  /** Check-in to check-out, minus breaks. 0 until checked out. */
  workedMinutes: z.number().int().nonnegative(),
  breakMinutes: z.number().int().nonnegative(),
  /** Worked past the scheduled end. */
  overtimeMinutes: z.number().int().nonnegative(),
  /** Worked between 22:00 and 05:00 Japan time. */
  nightMinutes: z.number().int().nonnegative(),
  /** Break still owed under the Labor Standards Act (45 min over 6h, 60 min over 8h). */
  breakShortfallMinutes: z.number().int().nonnegative(),
  /** Hourly wage × worked time, with 25% premiums for night work and for time beyond 8h. */
  estimatedPay: z.number().int().nonnegative(),
  onBreak: z.boolean(),
  missingPunch: z.enum(["none", "check_in", "check_out"]),
  correctionCount: z.number().int().nonnegative(),
});

export const WorkerShiftRecordSchema = z.object({
  shiftId: IdSchema,
  jobTitle: z.string(),
  scheduledStartAt: TimestampSchema,
  status: ShiftStatusSchema,
  punctuality: z.enum(["pending", "on_time", "late"]),
  minutesLate: z.number().int().nonnegative(),
  workedMinutes: z.number().int().nonnegative(),
  rating: z.number().int().min(1).max(5).nullable(),
});

/** What an organization knows about a worker from its own records. */
export const WorkerHistorySchema = z.object({
  workerId: IdSchema,
  displayName: z.string(),
  completedShifts: z.number().int().nonnegative(),
  noShows: z.number().int().nonnegative(),
  onTimeShifts: z.number().int().nonnegative(),
  lateShifts: z.number().int().nonnegative(),
  averageRating: z.number().nullable(),
  evaluationCount: z.number().int().nonnegative(),
  lastWorkedAt: TimestampSchema.nullable(),
  monthWorkedMinutes: z.number().int().nonnegative(),
  recentShifts: z.array(WorkerShiftRecordSchema),
});

export const EvaluationSchema = z.object({
  id: IdSchema,
  organizationId: IdSchema,
  shiftId: IdSchema,
  authorId: IdSchema,
  subjectType: z.enum(["worker", "store"]),
  subjectId: IdSchema,
  rating: z.number().int().min(1).max(5),
  tags: z.array(z.string().min(1).max(64)).max(10),
  comment: z.string().max(2000).optional(),
  submittedAt: TimestampSchema,
});

export const CreateEvaluationInputSchema = EvaluationSchema.pick({
  shiftId: true,
  subjectType: true,
  subjectId: true,
  rating: true,
  tags: true,
  comment: true,
});

export const LetterTemplateSchema = z.enum([...LETTER_TEMPLATE_CODES, "custom"] as const);

export const LetterReplyStampSchema = z.enum(["thanks", "see_you", "fun"]);

export const LetterSchema = z.object({
  id: IdSchema,
  organizationId: IdSchema,
  shiftId: IdSchema,
  workerId: IdSchema,
  authorId: IdSchema,
  template: LetterTemplateSchema,
  body: z.string().min(1).max(LETTER_BODY_MAX_LENGTH),
  sentAt: TimestampSchema,
  /** A stamp the worker sent back; the shop sees the stamp, never free text. */
  replyStamp: LetterReplyStampSchema.nullable(),
  repliedAt: TimestampSchema.nullable(),
});

export const ReplyLetterInputSchema = z.object({ replyStamp: LetterReplyStampSchema });

export const ShopReviewTagSchema = z.enum(SHOP_REVIEW_TAGS);
export const ShopLandmarkIdSchema = z.enum(SHOP_LANDMARK_IDS);

/**
 * The worker's ten-second review of the shop after a shift: stars and the
 * tags that applied, exactly as the worker app collects them. Individual
 * answers never reach the shop; only totals once five workers have answered.
 */
export const ShopFeedbackSchema = z.object({
  id: IdSchema,
  organizationId: IdSchema,
  storeId: IdSchema,
  shiftId: IdSchema,
  workerId: IdSchema,
  stars: z.number().int().min(1).max(5),
  tags: z.array(ShopReviewTagSchema).max(SHOP_REVIEW_TAGS.length),
  submittedAt: TimestampSchema,
});

export const CreateShopFeedbackInputSchema = ShopFeedbackSchema.pick({
  shiftId: true,
  stars: true,
  tags: true,
});

/** One landmark on the shop island and how far the votes have grown it. */
export const ShopLandmarkSchema = z.object({
  tag: ShopReviewTagSchema,
  id: ShopLandmarkIdSchema,
  votes: z.number().int().nonnegative(),
  level: z.number().int().min(0).max(3),
  sprout: z.boolean(),
});

export const ShopFeedbackSummarySchema = z.object({
  storeId: IdSchema,
  responses: z.number().int().nonnegative(),
  /** True once enough workers answered for totals and landmarks to be shown. */
  published: z.boolean(),
  averageStars: z.number().nullable(),
  /** Votes per tag; empty until published. */
  tags: z.record(ShopReviewTagSchema, z.number().int().nonnegative()),
  /** Every landmark, in island order; all at level 0 until published. */
  landmarks: z.array(ShopLandmarkSchema),
  /** Terrain size, 0–2. */
  stage: z.number().int().min(0).max(2),
});

/** Things the worker app reports so the shop can see the signals after a shift, in aggregate. */
export const WorkerActivitySchema = z.object({
  id: IdSchema,
  workerId: IdSchema,
  organizationId: IdSchema.nullable(),
  kind: z.enum(["app_opened", "island_visited"]),
  occurredAt: TimestampSchema,
});

export const CreateWorkerActivityInputSchema = z.object({
  kind: WorkerActivitySchema.shape.kind,
  organizationId: IdSchema.optional(),
  occurredAt: TimestampSchema.optional(),
});

export const JobInsightSchema = z.object({
  jobId: IdSchema,
  title: z.string(),
  storeId: IdSchema,
  status: JobPostingStatusSchema,
  startsAt: TimestampSchema,
  capacity: z.number().int(),
  applications: z.number().int().nonnegative(),
  selected: z.number().int().nonnegative(),
  /** Hours from publishing to the last opening being filled; null while open. */
  hoursToFill: z.number().nullable(),
  /** Share of decisions made within 24 hours; null with no decisions. */
  inTimeDecisionRate: z.number().nullable(),
});

/** The after-the-shift signals the pitch promises: did people come back? */
export const InsightsReportSchema = z.object({
  storeId: IdSchema.nullable(),
  days: z.number().int().positive(),
  completedShifts: z.number().int().nonnegative(),
  distinctWorkers: z.number().int().nonnegative(),
  /** Workers who opened the app within 48 hours of finishing / completed shifts. */
  nextDayOpenRate: z.number().nullable(),
  /** Workers with two or more completed shifts here / workers with one or more. */
  returnRate: z.number().nullable(),
  /** Workers who applied again after a completed shift / workers with a completed shift. */
  reapplyRate: z.number().nullable(),
  /** Withdrawals within 24 hours of the start / accepted shifts. */
  lastMinuteCancelRate: z.number().nullable(),
  noShowRate: z.number().nullable(),
  /** Job openings filled / openings published. */
  fillRate: z.number().nullable(),
  inTimeDecisionRate: z.number().nullable(),
  islandVisits: z.number().int().nonnegative(),
  jobs: z.array(JobInsightSchema),
});

export const AuditLogEntrySchema = z.object({
  id: z.number().int(),
  organizationId: IdSchema,
  actorId: IdSchema,
  action: z.string(),
  entityType: z.enum([
    "job_posting",
    "application",
    "attendance_event",
    "shift",
    "evaluation",
    "letter",
    "invitation",
    "store",
    "store_settings",
    "closed_period",
  ]),
  entityId: z.string(),
  before: z.unknown(),
  after: z.unknown(),
  createdAt: TimestampSchema,
});

export const CreateLetterInputSchema = z.object({
  shiftId: IdSchema,
  template: LetterTemplateSchema,
  /** Required when the template is "custom"; presets ignore it. */
  body: z.string().max(LETTER_BODY_MAX_LENGTH).optional(),
});

export const GameWorldSchema = z.object({
  id: IdSchema,
  ownerType: z.enum(["worker", "organization"]),
  ownerId: IdSchema,
  kind: z.enum(["worker_island", "employer_island"]),
  level: z.number().int().positive(),
  experience: z.number().int().nonnegative(),
  inventory: z.record(z.string(), z.number().int().nonnegative()),
  updatedAt: TimestampSchema,
});

export const RewardCodeSchema = z.enum([
  "application_selected",
  "shift_completed",
  "review_submitted",
  "job_published",
  "application_decided_in_time",
  "attendance_confirmed",
  "evaluation_submitted",
  "letter_sent",
  "shop_reviewed",
  "worker_returned",
]);

export const RewardGrantSchema = z.object({
  id: IdSchema,
  ownerType: GameWorldSchema.shape.ownerType,
  ownerId: IdSchema,
  eventKey: z.string().min(1),
  rewardCode: RewardCodeSchema,
  experience: z.number().int().nonnegative(),
  grantedAt: TimestampSchema,
});

export const ApiErrorCodeSchema = z.enum([
  "unauthorized",
  "invalid_request",
  "not_found",
  "invalid_transition",
  "capacity_reached",
  "invalid_time_range",
  "store_not_found",
  "empty_letter",
  "forbidden",
  "period_closed",
  "internal_error",
]);

export const ApiErrorSchema = z.object({
  error: ApiErrorCodeSchema,
  message: z.string().optional(),
});

export type Store = z.infer<typeof StoreSchema>;
export type UpdateStoreInput = z.infer<typeof UpdateStoreInputSchema>;
export type ShopLandmark = z.infer<typeof ShopLandmarkSchema>;
export type MemberRole = z.infer<typeof MemberRoleSchema>;
export type Member = z.infer<typeof MemberSchema>;
export type BreakRule = z.infer<typeof BreakRuleSchema>;
export type StoreSettings = z.infer<typeof StoreSettingsSchema>;
export type UpdateStoreSettingsInput = z.infer<typeof UpdateStoreSettingsInputSchema>;
export type Invitation = z.infer<typeof InvitationSchema>;
export type CreateInvitationInput = z.infer<typeof CreateInvitationInputSchema>;
export type RespondInvitationInput = z.infer<typeof RespondInvitationInputSchema>;
export type ClosedPeriod = z.infer<typeof ClosedPeriodSchema>;
export type ClosePeriodInput = z.infer<typeof ClosePeriodInputSchema>;
export type LetterReplyStamp = z.infer<typeof LetterReplyStampSchema>;
export type ReplyLetterInput = z.infer<typeof ReplyLetterInputSchema>;
export type ShopFeedback = z.infer<typeof ShopFeedbackSchema>;
export type CreateShopFeedbackInput = z.infer<typeof CreateShopFeedbackInputSchema>;
export type ShopFeedbackSummary = z.infer<typeof ShopFeedbackSummarySchema>;
export type WorkerActivity = z.infer<typeof WorkerActivitySchema>;
export type CreateWorkerActivityInput = z.infer<typeof CreateWorkerActivityInputSchema>;
export type JobInsight = z.infer<typeof JobInsightSchema>;
export type InsightsReport = z.infer<typeof InsightsReportSchema>;
export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;
export type JobRole = z.infer<typeof JobRoleSchema>;
export type JobPosting = z.infer<typeof JobPostingSchema>;
export type CreateJobPostingInput = z.infer<typeof CreateJobPostingInputSchema>;
export type Application = z.infer<typeof ApplicationSchema>;
export type CreateApplicationInput = z.infer<typeof CreateApplicationInputSchema>;
export type ApplicationDecisionInput = z.infer<typeof ApplicationDecisionInputSchema>;
export type Shift = z.infer<typeof ShiftSchema>;
export type AttendanceEvent = z.infer<typeof AttendanceEventSchema>;
export type AttendanceEventKind = z.infer<typeof AttendanceEventKindSchema>;
export type CorrectAttendanceInput = z.infer<typeof CorrectAttendanceInputSchema>;
export type WorkerShiftRecord = z.infer<typeof WorkerShiftRecordSchema>;
export type WorkerHistory = z.infer<typeof WorkerHistorySchema>;
export type RecordAttendanceInput = z.infer<typeof RecordAttendanceInputSchema>;
export type AttendanceSummary = z.infer<typeof AttendanceSummarySchema>;
export type Evaluation = z.infer<typeof EvaluationSchema>;
export type CreateEvaluationInput = z.infer<typeof CreateEvaluationInputSchema>;
export type LetterTemplate = z.infer<typeof LetterTemplateSchema>;
export type Letter = z.infer<typeof LetterSchema>;
export type CreateLetterInput = z.infer<typeof CreateLetterInputSchema>;
export type GameWorld = z.infer<typeof GameWorldSchema>;
export type RewardCode = z.infer<typeof RewardCodeSchema>;
export type RewardGrant = z.infer<typeof RewardGrantSchema>;
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
