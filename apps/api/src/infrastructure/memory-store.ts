import type {
  Application,
  ApplicationDecisionInput,
  AttendanceEvent,
  AttendanceSummary,
  AuditLogEntry,
  ClosedPeriod,
  ClosePeriodInput,
  CorrectAttendanceInput,
  CreateApplicationInput,
  CreateEvaluationInput,
  CreateInvitationInput,
  CreateJobPostingInput,
  CreateLetterInput,
  CreateShopFeedbackInput,
  CreateWorkerActivityInput,
  Evaluation,
  GameWorld,
  InsightsReport,
  Invitation,
  JobInsight,
  JobPosting,
  Letter,
  Member,
  MemberRole,
  RecordAttendanceInput,
  RewardCode,
  RewardGrant,
  Shift,
  ShopFeedback,
  ShopFeedbackSummary,
  ShopLandmark,
  ShopReviewTag,
  Store,
  StoreSettings,
  UpdateStoreInput,
  UpdateStoreSettingsInput,
  WorkerActivity,
  WorkerHistory,
  WorkerShiftRecord,
} from "@paw-time/api-contracts";
import {
  letterTemplateBody,
  SHOP_FEEDBACK_MIN_RESPONSES,
  SHOP_LANDMARK_FOR_TAG,
  SHOP_REVIEW_TAGS,
  SHOP_SPROUT_MIN,
  shopIslandStage,
  shopLandmarkLevel,
} from "@paw-time/api-contracts";
import { levelFor, rewardExperience } from "../domain/catalog.js";
import { createSeed, type SeedData } from "./seed.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const JST_OFFSET = 9 * HOUR;
const PUNCTUAL_GRACE_MINUTES = 5;
const DECISION_IN_TIME_MILLISECONDS = 24 * HOUR;
const LAST_MINUTE_MILLISECONDS = 24 * HOUR;
const NEXT_DAY_WINDOW_MILLISECONDS = 48 * HOUR;
const RECENT_REWARD_LIMIT = 20;
const RECENT_SHIFT_LIMIT = 5;
const URGENT_LEAD_MINUTES = 15;
/** A check-in this long after the start, or a check-out this long after the end, counts as a missed punch. */
const MISSING_CHECK_IN_GRACE = 15 * MINUTE;
const MISSING_CHECK_OUT_GRACE = 60 * MINUTE;
const LEGAL_DAILY_MINUTES = 8 * 60;
const NIGHT_START_HOUR = 22;
const NIGHT_END_HOUR = 5;

/** Labor Standards Act art. 34 defaults: 45 min of break over 6 hours of work, 60 min over 8 hours. */
export const DEFAULT_STORE_SETTINGS: Omit<StoreSettings, "storeId"> = {
  breakRules: [
    { workedOverMinutes: 8 * 60, requiredBreakMinutes: 60 },
    { workedOverMinutes: 6 * 60, requiredBreakMinutes: 45 },
  ],
  overtimePremiumRate: 0.25,
  nightPremiumRate: 0.25,
  roundingMinutes: 1,
  closingDay: 0,
};

export type StoreError =
  | "not_found"
  | "invalid_transition"
  | "capacity_reached"
  | "invalid_time_range"
  | "store_not_found"
  | "empty_letter"
  | "forbidden"
  | "period_closed";

export type Result<T> = { ok: true; value: T } | { ok: false; error: StoreError };

export type { AuditLogEntry };

/** Everything the store holds, for saving to disk or a database and loading back. */
export type StoreSnapshot = {
  version: 1;
  savedAt: string;
  stores: Store[];
  members: Member[];
  storeSettings: StoreSettings[];
  jobs: JobPosting[];
  applications: Application[];
  shifts: Shift[];
  attendanceEvents: AttendanceEvent[];
  evaluations: Evaluation[];
  letters: Letter[];
  invitations: Invitation[];
  closedPeriods: ClosedPeriod[];
  shopFeedback: ShopFeedback[];
  workerActivities: WorkerActivity[];
  worlds: GameWorld[];
  rewardGrants: RewardGrant[];
  auditLogs: AuditLogEntry[];
};

type MemoryStoreOptions = {
  now?: () => Date;
  seed?: SeedData;
  snapshot?: StoreSnapshot;
};

type Interval = { start: number; end: number };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = <T>(error: StoreError): Result<T> => ({ ok: false, error });

export class MemoryStore {
  private readonly now: () => Date;
  private readonly stores: Store[];
  private readonly members: Member[];
  private readonly storeSettings: StoreSettings[];
  private readonly jobs: JobPosting[];
  private readonly applications: Application[];
  private readonly attendanceEvents: AttendanceEvent[];
  private readonly evaluations: Evaluation[];
  private readonly letters: Letter[];
  private readonly shifts: Shift[];
  private readonly invitations: Invitation[];
  private readonly closedPeriods: ClosedPeriod[];
  private readonly shopFeedback: ShopFeedback[];
  private readonly workerActivities: WorkerActivity[];
  private readonly worlds: GameWorld[] = [];
  private readonly rewardGrants: RewardGrant[] = [];
  private readonly auditLogs: AuditLogEntry[] = [];
  private changeListeners: Array<() => void> = [];

  constructor({ now = () => new Date(), seed, snapshot }: MemoryStoreOptions = {}) {
    this.now = now;
    if (snapshot) {
      // A data file saved by an older build may lack newer collections: fill those from the seed so the app keeps working.
      const fallback = seed ?? createSeed(now());
      this.stores = snapshot.stores ?? fallback.stores;
      this.members = snapshot.members ?? fallback.members;
      this.storeSettings = snapshot.storeSettings ?? fallback.storeSettings;
      this.jobs = snapshot.jobs ?? [];
      this.applications = snapshot.applications ?? [];
      this.shifts = snapshot.shifts ?? [];
      this.attendanceEvents = snapshot.attendanceEvents ?? [];
      this.evaluations = snapshot.evaluations ?? [];
      this.letters = snapshot.letters ?? [];
      this.invitations = snapshot.invitations ?? [];
      this.closedPeriods = snapshot.closedPeriods ?? [];
      this.shopFeedback = snapshot.shopFeedback ?? [];
      this.workerActivities = snapshot.workerActivities ?? [];
      this.worlds = snapshot.worlds ?? [];
      this.rewardGrants = snapshot.rewardGrants ?? [];
      this.auditLogs = snapshot.auditLogs ?? [];
      return;
    }
    const data = seed ?? createSeed(now());
    this.stores = data.stores;
    this.members = data.members;
    this.storeSettings = data.storeSettings;
    this.jobs = data.jobs;
    this.applications = data.applications;
    this.attendanceEvents = data.attendanceEvents;
    this.evaluations = data.evaluations;
    this.letters = data.letters;
    this.shifts = data.shifts;
    this.invitations = data.invitations;
    this.closedPeriods = data.closedPeriods;
    this.shopFeedback = data.shopFeedback;
    this.workerActivities = data.workerActivities;
    for (const reward of data.rewards) {
      this.grant(reward.ownerType, reward.ownerId, reward.code, reward.eventKey, reward.grantedAt);
    }
    this.recordSeedTrail(data);
  }

  /** The demo data arrives already done; this writes the audit entries those actions would have left. */
  private recordSeedTrail(data: SeedData): void {
    const entries: Array<{ at: string; actorId: string; action: string; entityType: AuditLogEntry["entityType"]; entityId: string; after: unknown }> = [];
    for (const job of data.jobs) {
      entries.push({ at: job.createdAt, actorId: "member-demo", action: "job_posting.created", entityType: "job_posting", entityId: job.id, after: job });
      if (job.publishedAt) entries.push({ at: job.publishedAt, actorId: "member-demo", action: "job_posting.published", entityType: "job_posting", entityId: job.id, after: job });
    }
    for (const application of data.applications) {
      if (!application.decidedAt) continue;
      const actor = application.status === "withdrawn" ? application.workerId : "member-demo";
      entries.push({ at: application.decidedAt, actorId: actor, action: `application.${application.status}`, entityType: "application", entityId: application.id, after: application });
    }
    for (const event of data.attendanceEvents) {
      entries.push({ at: event.recordedAt, actorId: event.actorId, action: `attendance.${event.kind}`, entityType: "attendance_event", entityId: event.id, after: event });
    }
    for (const shift of data.shifts) {
      if (shift.status === "completed") entries.push({ at: addMinutes(shift.scheduledEndAt, 60), actorId: "member-demo", action: "shift.completed", entityType: "shift", entityId: shift.id, after: shift });
      if (shift.status === "no_show") entries.push({ at: addMinutes(shift.scheduledStartAt, 40), actorId: "member-demo", action: "shift.no_show", entityType: "shift", entityId: shift.id, after: shift });
      if (shift.status === "cancelled") {
        const application = data.applications.find((candidate) => candidate.id === shift.applicationId);
        entries.push({ at: application?.decidedAt ?? shift.scheduledStartAt, actorId: shift.workerId, action: "shift.cancelled", entityType: "shift", entityId: shift.id, after: shift });
      }
    }
    for (const evaluation of data.evaluations) {
      entries.push({ at: evaluation.submittedAt, actorId: evaluation.authorId, action: "evaluation.submitted", entityType: "evaluation", entityId: evaluation.id, after: evaluation });
    }
    for (const letter of data.letters) {
      entries.push({ at: letter.sentAt, actorId: letter.authorId, action: "letter.sent", entityType: "letter", entityId: letter.id, after: letter });
      if (letter.repliedAt) entries.push({ at: letter.repliedAt, actorId: letter.workerId, action: "letter.replied", entityType: "letter", entityId: letter.id, after: letter });
    }
    for (const period of data.closedPeriods) {
      entries.push({ at: period.closedAt, actorId: period.closedBy, action: "closed_period.closed", entityType: "closed_period", entityId: period.id, after: period });
    }
    entries.sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
    for (const entry of entries) {
      const organizationId = (entry.after as { organizationId?: string }).organizationId ?? "";
      this.auditLogs.push({
        id: this.auditLogs.length + 1,
        organizationId,
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        before: null,
        after: structuredClone(entry.after),
        createdAt: new Date(entry.at).toISOString(),
      });
    }
  }

  /** Called after anything changes, so a persistence layer can save. */
  onChange(listener: () => void): void {
    this.changeListeners.push(listener);
  }

  toSnapshot(): StoreSnapshot {
    return structuredClone({
      version: 1 as const,
      savedAt: this.timestamp(),
      stores: this.stores,
      members: this.members,
      storeSettings: this.storeSettings,
      jobs: this.jobs,
      applications: this.applications,
      shifts: this.shifts,
      attendanceEvents: this.attendanceEvents,
      evaluations: this.evaluations,
      letters: this.letters,
      invitations: this.invitations,
      closedPeriods: this.closedPeriods,
      shopFeedback: this.shopFeedback,
      workerActivities: this.workerActivities,
      worlds: this.worlds,
      rewardGrants: this.rewardGrants,
      auditLogs: this.auditLogs,
    });
  }

  // ---- organization, members, stores ----------------------------------------

  listStores(organizationId: string): Store[] {
    return this.stores.filter((store) => store.organizationId === organizationId);
  }

  listMembers(organizationId: string): Member[] {
    return this.members.filter((member) => member.organizationId === organizationId);
  }

  findMember(organizationId: string, actorId: string): Member | undefined {
    return this.members.find((member) => member.organizationId === organizationId && member.id === actorId);
  }

  /** Unknown actors get the least privilege. */
  roleOf(organizationId: string, actorId: string): MemberRole {
    return this.findMember(organizationId, actorId)?.role ?? "staff";
  }

  /** The shop's island look: logo, colors and its one line. Landmarks are never for sale. */
  updateStore(organizationId: string, actorId: string, storeId: string, input: UpdateStoreInput): Result<Store> {
    const store = this.stores.find((candidate) => candidate.id === storeId && candidate.organizationId === organizationId);
    if (!store) return fail("store_not_found");
    const before = { ...store };
    if (input.logoUrl !== undefined) store.logoUrl = input.logoUrl;
    if (input.signColor !== undefined) store.signColor = input.signColor;
    if (input.accentColor !== undefined) store.accentColor = input.accentColor;
    if (input.values !== undefined) store.values = input.values.trim();
    this.audit(organizationId, actorId, "store.updated", "store", store.id, before, store);
    return ok(store);
  }

  getStoreSettings(organizationId: string, storeId: string): StoreSettings | undefined {
    if (!this.stores.some((store) => store.id === storeId && store.organizationId === organizationId)) return undefined;
    return this.settingsFor(storeId);
  }

  listStoreSettings(organizationId: string): StoreSettings[] {
    return this.listStores(organizationId).map((store) => this.settingsFor(store.id));
  }

  updateStoreSettings(
    organizationId: string,
    actorId: string,
    storeId: string,
    input: UpdateStoreSettingsInput,
  ): Result<StoreSettings> {
    if (!this.stores.some((store) => store.id === storeId && store.organizationId === organizationId)) {
      return fail("store_not_found");
    }
    const before = this.settingsFor(storeId);
    const next: StoreSettings = {
      storeId,
      ...input,
      breakRules: [...input.breakRules].sort((left, right) => right.workedOverMinutes - left.workedOverMinutes),
    };
    const index = this.storeSettings.findIndex((settings) => settings.storeId === storeId);
    if (index === -1) this.storeSettings.push(next);
    else this.storeSettings[index] = next;
    this.audit(organizationId, actorId, "store_settings.updated", "store_settings", storeId, before, next);
    return ok(next);
  }

  // ---- jobs -----------------------------------------------------------------

  listPublishedJobs(): JobPosting[] {
    return this.jobs.filter((job) => job.status === "published");
  }

  listOrganizationJobs(organizationId: string): JobPosting[] {
    return this.jobs.filter((job) => job.organizationId === organizationId);
  }

  createJob(
    organizationId: string,
    actorId: string,
    input: CreateJobPostingInput,
  ): Result<JobPosting> {
    if (input.status === "closed") return fail("invalid_transition");
    if (!this.stores.some((store) => store.id === input.storeId && store.organizationId === organizationId)) {
      return fail("store_not_found");
    }
    if (Date.parse(input.endsAt) <= Date.parse(input.startsAt)) return fail("invalid_time_range");
    const { urgent, ...rest } = input;
    const job: JobPosting = {
      ...rest,
      id: crypto.randomUUID(),
      organizationId,
      urgent: urgent ?? false,
      publishedAt: input.status === "published" ? this.timestamp() : null,
      createdAt: this.timestamp(),
    };
    this.jobs.push(job);
    this.audit(organizationId, actorId, "job_posting.created", "job_posting", job.id, null, job);
    if (job.status === "published") {
      this.grant("organization", organizationId, "job_published", `job_published:${job.id}`);
    }
    return ok(job);
  }

  publishJob(organizationId: string, actorId: string, jobId: string): Result<JobPosting> {
    return this.transitionJob(organizationId, actorId, jobId, "draft", "published");
  }

  closeJob(organizationId: string, actorId: string, jobId: string): Result<JobPosting> {
    return this.transitionJob(organizationId, actorId, jobId, "published", "closed");
  }

  /**
   * Fills a sudden gap: a published, single-opening copy of the shift's job
   * that starts a little after now, marked urgent so past workers see it first.
   */
  createUrgentJob(organizationId: string, actorId: string, shiftId: string): Result<JobPosting> {
    const shift = this.findShift(organizationId, shiftId);
    if (!shift) return fail("not_found");
    if (shift.status !== "no_show" && shift.status !== "cancelled") return fail("invalid_transition");
    const source = this.jobs.find((job) => job.id === shift.jobPostingId);
    if (!source) return fail("not_found");
    const existing = this.jobs.find(
      (job) => job.urgent && job.status === "published" && job.description.includes(`[shift:${shift.id}]`),
    );
    if (existing) return ok(existing);
    const nowMs = this.now().getTime();
    const earliest = Math.ceil((nowMs + URGENT_LEAD_MINUTES * MINUTE) / (5 * MINUTE)) * 5 * MINUTE;
    const startsAt = Math.max(Date.parse(shift.scheduledStartAt), earliest);
    const endsAt = Date.parse(shift.scheduledEndAt);
    if (endsAt - startsAt < 30 * MINUTE) return fail("invalid_time_range");
    const job: JobPosting = {
      id: crypto.randomUUID(),
      organizationId,
      storeId: source.storeId,
      title: `【急募】${source.title}`,
      description: `${source.description}\n\n[shift:${shift.id}]`,
      role: source.role,
      hourlyWage: source.hourlyWage,
      startsAt: toJstTimestamp(startsAt),
      endsAt: shift.scheduledEndAt,
      capacity: 1,
      status: "published",
      urgent: true,
      publishedAt: this.timestamp(),
      createdAt: this.timestamp(),
    };
    this.jobs.push(job);
    this.audit(organizationId, actorId, "job_posting.urgent", "job_posting", job.id, { shiftId: shift.id }, job);
    this.grant("organization", organizationId, "job_published", `job_published:${job.id}`);
    return ok(job);
  }

  // ---- applications and invitations ------------------------------------------

  listApplications(organizationId: string): Application[] {
    return this.applications.filter(
      (application) => application.organizationId === organizationId,
    );
  }

  applyForJob(workerId: string, input: CreateApplicationInput): Application | undefined {
    const job = this.jobs.find(
      (candidate) => candidate.id === input.jobPostingId && candidate.status === "published",
    );
    if (!job) return undefined;
    const existing = this.applications.find(
      (application) =>
        application.jobPostingId === input.jobPostingId && application.workerId === workerId,
    );
    if (existing) return existing;
    const application: Application = {
      id: crypto.randomUUID(),
      organizationId: job.organizationId,
      jobPostingId: job.id,
      workerId,
      workerDisplayName: input.workerDisplayName,
      status: "applied",
      appliedAt: this.timestamp(),
      decidedAt: null,
      decisionNote: null,
    };
    this.applications.push(application);
    this.changed();
    return application;
  }

  /** The worker steps back. A shift that was already created is cancelled. */
  withdrawApplication(workerId: string, applicationId: string): Result<Application> {
    const application = this.applications.find(
      (candidate) => candidate.id === applicationId && candidate.workerId === workerId,
    );
    if (!application) return fail("not_found");
    if (application.status !== "applied" && application.status !== "selected") return fail("invalid_transition");
    const shift = this.shifts.find((candidate) => candidate.applicationId === application.id);
    if (shift && shift.status !== "scheduled") return fail("invalid_transition");
    const before = { ...application };
    application.status = "withdrawn";
    application.decidedAt = this.timestamp();
    if (shift) {
      const shiftBefore = { ...shift };
      shift.status = "cancelled";
      this.audit(application.organizationId, workerId, "shift.cancelled", "shift", shift.id, shiftBefore, shift);
    }
    this.audit(application.organizationId, workerId, "application.withdrawn", "application", application.id, before, application);
    return ok(application);
  }

  decideApplication(
    organizationId: string,
    actorId: string,
    applicationId: string,
    input: ApplicationDecisionInput,
  ): Result<Application> {
    const application = this.applications.find(
      (candidate) =>
        candidate.id === applicationId && candidate.organizationId === organizationId,
    );
    if (!application) return fail("not_found");
    if (application.status !== "applied") return fail("invalid_transition");
    const job = this.jobs.find((candidate) => candidate.id === application.jobPostingId);
    if (!job) return fail("not_found");

    if (input.decision === "selected") {
      if (job.status !== "published") return fail("invalid_transition");
      if (this.selectedCount(job.id) >= job.capacity) return fail("capacity_reached");
    }

    const before = { ...application };
    application.status = input.decision;
    application.decidedAt = this.timestamp();
    application.decisionNote = input.note?.trim() || null;
    this.audit(
      organizationId,
      actorId,
      `application.${input.decision}`,
      "application",
      application.id,
      before,
      application,
    );

    if (Date.parse(application.decidedAt) - Date.parse(application.appliedAt) <= DECISION_IN_TIME_MILLISECONDS) {
      this.grant(
        "organization",
        organizationId,
        "application_decided_in_time",
        `application_decided_in_time:${application.id}`,
      );
    }

    if (input.decision === "selected") this.hire(application, job);
    return ok(application);
  }

  listInvitations(organizationId: string): Invitation[] {
    return this.invitations.filter((invitation) => invitation.organizationId === organizationId);
  }

  listWorkerInvitations(workerId: string): Invitation[] {
    return this.invitations.filter((invitation) => invitation.workerId === workerId);
  }

  /** Asks someone who has worked here before to take a job. One invitation per worker and job. */
  createInvitation(organizationId: string, actorId: string, input: CreateInvitationInput): Result<Invitation> {
    const job = this.jobs.find((candidate) => candidate.id === input.jobPostingId && candidate.organizationId === organizationId);
    if (!job) return fail("not_found");
    if (job.status !== "published") return fail("invalid_transition");
    const existing = this.invitations.find(
      (invitation) => invitation.jobPostingId === job.id && invitation.workerId === input.workerId,
    );
    if (existing) return ok(existing);
    const known = this.applications.find(
      (application) => application.organizationId === organizationId && application.workerId === input.workerId,
    );
    if (!known) return fail("not_found");
    const invitation: Invitation = {
      id: crypto.randomUUID(),
      organizationId,
      jobPostingId: job.id,
      workerId: input.workerId,
      workerDisplayName: known.workerDisplayName,
      status: "sent",
      sentAt: this.timestamp(),
      respondedAt: null,
    };
    this.invitations.push(invitation);
    this.audit(organizationId, actorId, "invitation.sent", "invitation", invitation.id, null, invitation);
    return ok(invitation);
  }

  /** Accepting an invitation hires the worker straight away, while an opening is left. */
  respondToInvitation(workerId: string, invitationId: string, response: Invitation["status"]): Result<Invitation> {
    const invitation = this.invitations.find(
      (candidate) => candidate.id === invitationId && candidate.workerId === workerId,
    );
    if (!invitation) return fail("not_found");
    if (invitation.status !== "sent") return fail("invalid_transition");
    if (response === "sent") return fail("invalid_transition");
    const job = this.jobs.find((candidate) => candidate.id === invitation.jobPostingId);
    if (!job) return fail("not_found");
    if (response === "accepted") {
      if (job.status !== "published") return fail("invalid_transition");
      if (this.selectedCount(job.id) >= job.capacity) return fail("capacity_reached");
    }
    const before = { ...invitation };
    invitation.status = response;
    invitation.respondedAt = this.timestamp();
    this.audit(invitation.organizationId, workerId, `invitation.${response}`, "invitation", invitation.id, before, invitation);
    if (response === "accepted") {
      let application = this.applications.find(
        (candidate) => candidate.jobPostingId === job.id && candidate.workerId === workerId,
      );
      if (!application) {
        application = {
          id: crypto.randomUUID(),
          organizationId: job.organizationId,
          jobPostingId: job.id,
          workerId,
          workerDisplayName: invitation.workerDisplayName,
          status: "applied",
          appliedAt: this.timestamp(),
          decidedAt: null,
          decisionNote: null,
        };
        this.applications.push(application);
      }
      if (application.status === "applied") {
        application.status = "selected";
        application.decidedAt = this.timestamp();
        application.decisionNote = null;
        this.hire(application, job);
      }
    }
    return ok(invitation);
  }

  // ---- shifts and attendance -------------------------------------------------

  listOrganizationShifts(organizationId: string): Shift[] {
    return this.shifts.filter((shift) => shift.organizationId === organizationId);
  }

  listWorkerShifts(workerId: string): Shift[] {
    return this.shifts.filter((shift) => shift.workerId === workerId);
  }

  /** Appends a punch. Breaks sit between check-in and check-out; a check-out needs the break closed. */
  recordAttendance(
    organizationId: string,
    shiftId: string,
    actorId: string,
    source: AttendanceEvent["source"],
    input: RecordAttendanceInput,
  ): Result<AttendanceEvent> {
    const shift = this.findShift(organizationId, shiftId);
    if (!shift) return fail("not_found");
    return this.punch(shift, actorId, source, input);
  }

  /** The worker punches their own shift, from the worker app or the shop's tablet. */
  recordWorkerAttendance(workerId: string, shiftId: string, input: RecordAttendanceInput): Result<AttendanceEvent> {
    const shift = this.shifts.find((candidate) => candidate.id === shiftId && candidate.workerId === workerId);
    if (!shift) return fail("not_found");
    return this.punch(shift, workerId, "worker", input);
  }

  private punch(
    shift: Shift,
    actorId: string,
    source: AttendanceEvent["source"],
    input: RecordAttendanceInput,
  ): Result<AttendanceEvent> {
    const existing = this.attendanceEvents.find(
      (event) =>
        event.organizationId === shift.organizationId &&
        event.clientRequestId === input.clientRequestId,
    );
    if (existing) return ok(existing);
    if (this.isClosed(shift)) return fail("period_closed");

    const effective = this.effectiveEvents(shift.id);
    const onBreak = this.isOnBreak(effective);
    const recordedAt = Date.parse(input.recordedAt);
    const latest = effective[effective.length - 1];
    switch (input.kind) {
      case "check_in":
        if (shift.status !== "scheduled") return fail("invalid_transition");
        break;
      case "break_start":
        if (shift.status !== "checked_in" || onBreak) return fail("invalid_transition");
        break;
      case "break_end":
        if (shift.status !== "checked_in" || !onBreak) return fail("invalid_transition");
        break;
      case "check_out":
        if (shift.status !== "checked_in" || onBreak) return fail("invalid_transition");
        break;
    }
    if (latest && recordedAt < Date.parse(latest.recordedAt)) return fail("invalid_time_range");

    const event: AttendanceEvent = {
      ...input,
      id: crypto.randomUUID(),
      organizationId: shift.organizationId,
      shiftId: shift.id,
      actorId,
      source,
      correctionOfEventId: null,
      note: null,
    };
    this.attendanceEvents.push(event);
    if (event.kind === "check_in") shift.status = "checked_in";
    if (event.kind === "check_out") shift.status = "checked_out";
    this.audit(shift.organizationId, actorId, `attendance.${event.kind}`, "attendance_event", event.id, null, event);
    return ok(event);
  }

  /** Replaces a punch time with a reason. The original stays on record, superseded by the new event. */
  correctAttendance(
    organizationId: string,
    shiftId: string,
    actorId: string,
    input: CorrectAttendanceInput,
  ): Result<AttendanceEvent> {
    const shift = this.findShift(organizationId, shiftId);
    if (!shift) return fail("not_found");
    if (shift.status === "no_show" || shift.status === "scheduled" || shift.status === "cancelled") {
      return fail("invalid_transition");
    }
    const existing = this.attendanceEvents.find(
      (event) =>
        event.organizationId === organizationId &&
        event.clientRequestId === input.clientRequestId,
    );
    if (existing) return ok(existing);
    if (this.isClosed(shift)) return fail("period_closed");

    const effective = this.effectiveEvents(shift.id);
    const target = effective.find((event) => event.id === input.eventId);
    if (!target) return fail("not_found");
    const recordedAt = Date.parse(input.recordedAt);
    const index = effective.indexOf(target);
    const previous = effective[index - 1];
    const next = effective[index + 1];
    if (previous && recordedAt < Date.parse(previous.recordedAt)) return fail("invalid_time_range");
    if (next && recordedAt > Date.parse(next.recordedAt)) return fail("invalid_time_range");

    const correction: AttendanceEvent = {
      id: crypto.randomUUID(),
      organizationId,
      shiftId: shift.id,
      kind: target.kind,
      recordedAt: input.recordedAt,
      source: "employer",
      actorId,
      clientRequestId: input.clientRequestId,
      correctionOfEventId: target.id,
      note: input.reason.trim(),
    };
    this.attendanceEvents.push(correction);
    this.audit(organizationId, actorId, "attendance.corrected", "attendance_event", correction.id, target, correction);
    return ok(correction);
  }

  /** Confirms the punches. A worker coming back for another confirmed shift grows the island too. */
  confirmShift(organizationId: string, actorId: string, shiftId: string): Result<Shift> {
    const shift = this.findShift(organizationId, shiftId);
    if (!shift) return fail("not_found");
    if (shift.status !== "checked_out") return fail("invalid_transition");
    if (this.isClosed(shift)) return fail("period_closed");
    const returning = this.shifts.some(
      (candidate) =>
        candidate.organizationId === organizationId &&
        candidate.workerId === shift.workerId &&
        candidate.id !== shift.id &&
        candidate.status === "completed",
    );
    const before = { ...shift };
    shift.status = "completed";
    this.audit(organizationId, actorId, "shift.completed", "shift", shift.id, before, shift);
    this.grant("organization", organizationId, "attendance_confirmed", `attendance_confirmed:${shift.id}`);
    this.grant("worker", shift.workerId, "shift_completed", `shift_completed:${shift.id}`);
    if (returning) this.grant("organization", organizationId, "worker_returned", `worker_returned:${shift.id}`);
    return ok(shift);
  }

  markNoShow(organizationId: string, actorId: string, shiftId: string): Result<Shift> {
    const shift = this.findShift(organizationId, shiftId);
    if (!shift) return fail("not_found");
    if (shift.status !== "scheduled") return fail("invalid_transition");
    if (this.now().getTime() < Date.parse(shift.scheduledStartAt)) return fail("invalid_transition");
    if (this.isClosed(shift)) return fail("period_closed");
    const before = { ...shift };
    shift.status = "no_show";
    this.audit(organizationId, actorId, "shift.no_show", "shift", shift.id, before, shift);
    return ok(shift);
  }

  getAttendanceSummary(
    organizationId: string,
    shiftId: string,
  ): AttendanceSummary | undefined {
    const shift = this.findShift(organizationId, shiftId);
    return shift ? this.summarize(shift) : undefined;
  }

  listAttendanceSummaries(organizationId: string): AttendanceSummary[] {
    return this.listOrganizationShifts(organizationId).map((shift) => this.summarize(shift));
  }

  listAttendanceEvents(organizationId: string, shiftId: string): AttendanceEvent[] | undefined {
    const shift = this.findShift(organizationId, shiftId);
    if (!shift) return undefined;
    return this.attendanceEvents
      .filter((event) => event.shiftId === shift.id)
      .sort((left, right) => Date.parse(left.recordedAt) - Date.parse(right.recordedAt));
  }

  /** Every punch the organization has, corrections included, oldest first. */
  listOrganizationAttendanceEvents(organizationId: string): AttendanceEvent[] {
    return this.attendanceEvents
      .filter((event) => event.organizationId === organizationId)
      .sort((left, right) => Date.parse(left.recordedAt) - Date.parse(right.recordedAt));
  }

  // ---- closed periods --------------------------------------------------------

  listClosedPeriods(organizationId: string): ClosedPeriod[] {
    return this.closedPeriods.filter((period) => period.organizationId === organizationId);
  }

  /** Locks a month. Nothing in it can be punched, corrected, confirmed or marked absent afterwards. */
  closePeriod(organizationId: string, actorId: string, input: ClosePeriodInput): Result<ClosedPeriod> {
    if (!this.stores.some((store) => store.id === input.storeId && store.organizationId === organizationId)) {
      return fail("store_not_found");
    }
    const existing = this.closedPeriods.find(
      (period) => period.storeId === input.storeId && period.month === input.month,
    );
    if (existing) return ok(existing);
    if (input.month > jstMonthKey(this.now().getTime())) return fail("invalid_time_range");
    const period: ClosedPeriod = {
      id: crypto.randomUUID(),
      organizationId,
      storeId: input.storeId,
      month: input.month,
      closedAt: this.timestamp(),
      closedBy: actorId,
    };
    this.closedPeriods.push(period);
    this.audit(organizationId, actorId, "closed_period.closed", "closed_period", period.id, null, period);
    return ok(period);
  }

  reopenPeriod(organizationId: string, actorId: string, periodId: string): Result<ClosedPeriod> {
    const index = this.closedPeriods.findIndex(
      (period) => period.id === periodId && period.organizationId === organizationId,
    );
    if (index === -1) return fail("not_found");
    const [period] = this.closedPeriods.splice(index, 1);
    if (!period) return fail("not_found");
    this.audit(organizationId, actorId, "closed_period.reopened", "closed_period", period.id, period, null);
    return ok(period);
  }

  private isClosed(shift: Shift): boolean {
    const month = jstMonthKey(Date.parse(shift.scheduledStartAt));
    return this.closedPeriods.some((period) => period.storeId === shift.storeId && period.month === month);
  }

  // ---- evaluations, letters, feedback ----------------------------------------

  listEvaluations(organizationId: string): Evaluation[] {
    return this.evaluations.filter((evaluation) => evaluation.organizationId === organizationId);
  }

  createEvaluation(
    organizationId: string,
    actorId: string,
    input: CreateEvaluationInput,
  ): Result<Evaluation> {
    const shift = this.findShift(organizationId, input.shiftId);
    if (!shift) return fail("not_found");
    if (input.subjectType !== "worker" || input.subjectId !== shift.workerId) {
      return fail("not_found");
    }
    const existing = this.evaluations.find(
      (candidate) =>
        candidate.shiftId === input.shiftId &&
        candidate.authorId === actorId &&
        candidate.subjectType === input.subjectType &&
        candidate.subjectId === input.subjectId,
    );
    if (existing) return ok(existing);
    if (shift.status !== "completed") return fail("invalid_transition");
    const evaluation: Evaluation = {
      ...input,
      id: crypto.randomUUID(),
      organizationId,
      authorId: actorId,
      submittedAt: this.timestamp(),
    };
    this.evaluations.push(evaluation);
    this.audit(organizationId, actorId, "evaluation.submitted", "evaluation", evaluation.id, null, evaluation);
    this.grant(
      "organization",
      organizationId,
      "evaluation_submitted",
      `evaluation_submitted:${evaluation.id}`,
    );
    return ok(evaluation);
  }

  listLetters(organizationId: string): Letter[] {
    return this.letters.filter((letter) => letter.organizationId === organizationId);
  }

  listWorkerLetters(workerId: string): Letter[] {
    return this.letters.filter((letter) => letter.workerId === workerId);
  }

  /** A short message to the worker once their shift is over; the first one per shift earns points. */
  createLetter(organizationId: string, actorId: string, input: CreateLetterInput): Result<Letter> {
    const shift = this.findShift(organizationId, input.shiftId);
    if (!shift) return fail("not_found");
    if (shift.status !== "checked_out" && shift.status !== "completed") return fail("invalid_transition");
    const body = input.template === "custom" ? (input.body ?? "").trim() : letterTemplateBody(input.template);
    if (!body) return fail("empty_letter");
    const letter: Letter = {
      id: crypto.randomUUID(),
      organizationId,
      shiftId: shift.id,
      workerId: shift.workerId,
      authorId: actorId,
      template: input.template,
      body,
      sentAt: this.timestamp(),
      replyStamp: null,
      repliedAt: null,
    };
    this.letters.push(letter);
    this.audit(organizationId, actorId, "letter.sent", "letter", letter.id, null, letter);
    this.grant("organization", organizationId, "letter_sent", `letter_sent:${shift.id}`);
    return ok(letter);
  }

  /** The worker answers with a stamp, never with text the shop could read. */
  replyToLetter(workerId: string, letterId: string, stamp: NonNullable<Letter["replyStamp"]>): Result<Letter> {
    const letter = this.letters.find((candidate) => candidate.id === letterId && candidate.workerId === workerId);
    if (!letter) return fail("not_found");
    const before = { ...letter };
    letter.replyStamp = stamp;
    letter.repliedAt = this.timestamp();
    this.audit(letter.organizationId, workerId, "letter.replied", "letter", letter.id, before, letter);
    return ok(letter);
  }

  /** One answer per worker and shift, after the shift is over. Grows the shop's island. */
  createShopFeedback(workerId: string, input: CreateShopFeedbackInput): Result<ShopFeedback> {
    const shift = this.shifts.find((candidate) => candidate.id === input.shiftId && candidate.workerId === workerId);
    if (!shift) return fail("not_found");
    if (shift.status !== "checked_out" && shift.status !== "completed") return fail("invalid_transition");
    const existing = this.shopFeedback.find((feedback) => feedback.shiftId === shift.id);
    if (existing) return ok(existing);
    const feedback: ShopFeedback = {
      ...input,
      tags: [...new Set(input.tags)],
      id: crypto.randomUUID(),
      organizationId: shift.organizationId,
      storeId: shift.storeId,
      workerId,
      submittedAt: this.timestamp(),
    };
    this.shopFeedback.push(feedback);
    this.grant("organization", shift.organizationId, "shop_reviewed", `shop_reviewed:${shift.id}`);
    this.changed();
    return ok(feedback);
  }

  /**
   * What the worker app shows on the shop island: votes per tag and the landmark
   * each has grown into. Nothing is revealed until enough different workers answered.
   */
  shopFeedbackSummary(organizationId: string, storeId: string): ShopFeedbackSummary | undefined {
    if (!this.stores.some((store) => store.id === storeId && store.organizationId === organizationId)) return undefined;
    const answers = this.shopFeedback.filter((feedback) => feedback.storeId === storeId);
    const workers = new Set(answers.map((feedback) => feedback.workerId)).size;
    const published = workers >= SHOP_FEEDBACK_MIN_RESPONSES;
    const tags = Object.fromEntries(SHOP_REVIEW_TAGS.map((tag) => [tag, 0])) as Record<ShopReviewTag, number>;
    if (published) {
      for (const feedback of answers) {
        for (const tag of feedback.tags) tags[tag] += 1;
      }
    }
    const landmarks: ShopLandmark[] = SHOP_REVIEW_TAGS.map((tag) => {
      const votes = tags[tag];
      const level = shopLandmarkLevel(votes);
      return { tag, id: SHOP_LANDMARK_FOR_TAG[tag], votes, level, sprout: level === 0 && votes >= SHOP_SPROUT_MIN };
    });
    const totalLevel = landmarks.reduce((sum, landmark) => sum + landmark.level, 0);
    return {
      storeId,
      responses: answers.length,
      published,
      averageStars: published
        ? Math.round((answers.reduce((sum, feedback) => sum + feedback.stars, 0) / answers.length) * 10) / 10
        : null,
      tags,
      landmarks,
      stage: shopIslandStage(totalLevel),
    };
  }

  // ---- worker activity and insights ------------------------------------------

  recordWorkerActivity(workerId: string, input: CreateWorkerActivityInput): WorkerActivity {
    const activity: WorkerActivity = {
      id: crypto.randomUUID(),
      workerId,
      organizationId: input.organizationId ?? null,
      kind: input.kind,
      occurredAt: input.occurredAt ?? this.timestamp(),
    };
    this.workerActivities.push(activity);
    this.changed();
    return activity;
  }

  /** The after-the-shift signals, over the last `days`, for one store or the whole organization. */
  insights(organizationId: string, storeId: string | null, days: number): InsightsReport {
    const nowMs = this.now().getTime();
    const windowStart = nowMs - days * DAY;
    const inStore = <T extends { storeId: string }>(record: T) => storeId === null || record.storeId === storeId;
    const shifts = this.listOrganizationShifts(organizationId).filter(inStore);
    const windowShifts = shifts.filter((shift) => Date.parse(shift.scheduledStartAt) >= windowStart);
    const completed = windowShifts.filter((shift) => shift.status === "completed");
    const jobs = this.listOrganizationJobs(organizationId)
      .filter(inStore)
      .filter((job) => job.status !== "draft" && Date.parse(job.startsAt) >= windowStart);
    const jobIds = new Set(jobs.map((job) => job.id));
    const applications = this.listApplications(organizationId).filter((application) => jobIds.has(application.jobPostingId));
    const activities = this.workerActivities.filter((activity) => Date.parse(activity.occurredAt) >= windowStart);
    const ratio = (numerator: number, denominator: number): number | null =>
      denominator === 0 ? null : Math.round((numerator / denominator) * 100) / 100;

    const openedNextDay = completed.filter((shift) => {
      const end = Date.parse(shift.scheduledEndAt);
      return this.workerActivities.some(
        (activity) =>
          activity.workerId === shift.workerId &&
          activity.kind === "app_opened" &&
          Date.parse(activity.occurredAt) > end &&
          Date.parse(activity.occurredAt) <= end + NEXT_DAY_WINDOW_MILLISECONDS,
      );
    }).length;

    const completedByWorker = new Map<string, Shift[]>();
    for (const shift of shifts.filter((candidate) => candidate.status === "completed")) {
      completedByWorker.set(shift.workerId, [...(completedByWorker.get(shift.workerId) ?? []), shift]);
    }
    const workersWithShift = [...completedByWorker.keys()];
    const returning = workersWithShift.filter((workerId) => (completedByWorker.get(workerId)?.length ?? 0) >= 2).length;
    const reapplied = workersWithShift.filter((workerId) => {
      const first = Math.min(...(completedByWorker.get(workerId) ?? []).map((shift) => Date.parse(shift.scheduledEndAt)));
      return this.applications.some(
        (application) =>
          application.organizationId === organizationId &&
          application.workerId === workerId &&
          Date.parse(application.appliedAt) > first,
      );
    }).length;

    const accepted = windowShifts.filter((shift) => shift.status !== "no_show" || true);
    const lastMinute = windowShifts.filter((shift) => {
      if (shift.status !== "cancelled") return false;
      const application = this.applications.find((candidate) => candidate.id === shift.applicationId);
      if (!application?.decidedAt) return false;
      return Date.parse(shift.scheduledStartAt) - Date.parse(application.decidedAt) <= LAST_MINUTE_MILLISECONDS;
    }).length;
    const attended = windowShifts.filter((shift) => ["completed", "checked_out", "no_show"].includes(shift.status));
    const noShows = attended.filter((shift) => shift.status === "no_show").length;

    const decided = applications.filter((application) => application.decidedAt && application.status !== "withdrawn");
    const inTime = decided.filter(
      (application) =>
        Date.parse(application.decidedAt ?? "") - Date.parse(application.appliedAt) <= DECISION_IN_TIME_MILLISECONDS,
    ).length;
    const openings = jobs.reduce((sum, job) => sum + job.capacity, 0);
    const filled = jobs.reduce((sum, job) => sum + Math.min(job.capacity, this.selectedCount(job.id)), 0);

    const jobInsights: JobInsight[] = jobs
      .sort((left, right) => Date.parse(right.startsAt) - Date.parse(left.startsAt))
      .map((job) => {
        const jobApplications = applications.filter((application) => application.jobPostingId === job.id);
        const selections = jobApplications
          .filter((application) => application.status === "selected" && application.decidedAt)
          .sort((left, right) => Date.parse(left.decidedAt ?? "") - Date.parse(right.decidedAt ?? ""));
        const lastFill = selections[job.capacity - 1];
        const jobDecided = jobApplications.filter((application) => application.decidedAt && application.status !== "withdrawn");
        const jobInTime = jobDecided.filter(
          (application) =>
            Date.parse(application.decidedAt ?? "") - Date.parse(application.appliedAt) <= DECISION_IN_TIME_MILLISECONDS,
        ).length;
        return {
          jobId: job.id,
          title: job.title,
          storeId: job.storeId,
          status: job.status,
          startsAt: job.startsAt,
          capacity: job.capacity,
          applications: jobApplications.length,
          selected: this.selectedCount(job.id),
          hoursToFill:
            lastFill?.decidedAt && job.publishedAt
              ? Math.round(((Date.parse(lastFill.decidedAt) - Date.parse(job.publishedAt)) / HOUR) * 10) / 10
              : null,
          inTimeDecisionRate: ratio(jobInTime, jobDecided.length),
        };
      });

    return {
      storeId,
      days,
      completedShifts: completed.length,
      distinctWorkers: new Set(completed.map((shift) => shift.workerId)).size,
      nextDayOpenRate: ratio(openedNextDay, completed.length),
      returnRate: ratio(returning, workersWithShift.length),
      reapplyRate: ratio(reapplied, workersWithShift.length),
      lastMinuteCancelRate: ratio(lastMinute, accepted.length),
      noShowRate: ratio(noShows, attended.length),
      fillRate: ratio(filled, openings),
      inTimeDecisionRate: ratio(inTime, decided.length),
      islandVisits: activities.filter(
        (activity) => activity.kind === "island_visited" && activity.organizationId === organizationId,
      ).length,
      jobs: jobInsights,
    };
  }

  /** Everything the organization knows about each worker who applied or worked with it. */
  listWorkerHistories(organizationId: string): WorkerHistory[] {
    const applications = this.listApplications(organizationId);
    const shifts = this.listOrganizationShifts(organizationId);
    const evaluations = this.listEvaluations(organizationId);
    const workerIds = [...new Set([...applications, ...shifts].map((record) => record.workerId))];
    const monthKey = jstMonthKey(this.now().getTime());

    return workerIds.map((workerId) => {
      const workerShifts = shifts
        .filter((shift) => shift.workerId === workerId)
        .sort((left, right) => Date.parse(right.scheduledStartAt) - Date.parse(left.scheduledStartAt));
      const displayName =
        [...applications]
          .filter((application) => application.workerId === workerId)
          .sort((left, right) => Date.parse(right.appliedAt) - Date.parse(left.appliedAt))[0]?.workerDisplayName ?? workerId;
      const records: WorkerShiftRecord[] = workerShifts.map((shift) => {
        const summary = this.summarize(shift);
        const job = this.jobs.find((candidate) => candidate.id === shift.jobPostingId);
        const evaluation = evaluations.find(
          (candidate) => candidate.shiftId === shift.id && candidate.subjectId === workerId,
        );
        return {
          shiftId: shift.id,
          jobTitle: job?.title ?? "",
          scheduledStartAt: shift.scheduledStartAt,
          status: shift.status,
          punctuality: summary.punctuality,
          minutesLate: summary.minutesLate,
          workedMinutes: summary.workedMinutes,
          rating: evaluation?.rating ?? null,
        };
      });
      const finished = records.filter((record) => record.status === "completed" || record.status === "checked_out");
      const ratings = records.map((record) => record.rating).filter((rating): rating is number => rating !== null);
      const completed = records.filter((record) => record.status === "completed");
      return {
        workerId,
        displayName,
        completedShifts: completed.length,
        noShows: records.filter((record) => record.status === "no_show").length,
        onTimeShifts: finished.filter((record) => record.punctuality === "on_time").length,
        lateShifts: finished.filter((record) => record.punctuality === "late").length,
        averageRating: ratings.length
          ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10
          : null,
        evaluationCount: ratings.length,
        lastWorkedAt: completed[0]?.scheduledStartAt ?? null,
        monthWorkedMinutes: completed
          .filter((record) => jstMonthKey(Date.parse(record.scheduledStartAt)) === monthKey)
          .reduce((sum, record) => sum + record.workedMinutes, 0),
        recentShifts: records.slice(0, RECENT_SHIFT_LIMIT),
      };
    });
  }

  // ---- game world -----------------------------------------------------------

  getWorld(ownerType: GameWorld["ownerType"], ownerId: string): GameWorld {
    const existing = this.worlds.find(
      (world) => world.ownerType === ownerType && world.ownerId === ownerId,
    );
    if (existing) return existing;

    const kind: GameWorld["kind"] = ownerType === "worker" ? "worker_island" : "employer_island";
    const { level, unlocks } = levelFor(kind, 0);
    const created: GameWorld = {
      id: crypto.randomUUID(),
      ownerType,
      ownerId,
      kind,
      level,
      experience: 0,
      inventory: Object.fromEntries(unlocks.map((item) => [item, 1])),
      updatedAt: this.timestamp(),
    };
    this.worlds.push(created);
    return created;
  }

  listRewards(ownerType: GameWorld["ownerType"], ownerId: string): RewardGrant[] {
    return this.rewardGrants
      .filter((grant) => grant.ownerType === ownerType && grant.ownerId === ownerId)
      .sort((left, right) => Date.parse(right.grantedAt) - Date.parse(left.grantedAt))
      .slice(0, RECENT_REWARD_LIMIT);
  }

  listAuditLogs(organizationId: string): AuditLogEntry[] {
    return this.auditLogs.filter((entry) => entry.organizationId === organizationId);
  }

  // ---- internals ------------------------------------------------------------

  private settingsFor(storeId: string): StoreSettings {
    return this.storeSettings.find((settings) => settings.storeId === storeId) ?? { storeId, ...structuredClone(DEFAULT_STORE_SETTINGS) };
  }

  private selectedCount(jobId: string): number {
    return this.applications.filter(
      (candidate) => candidate.jobPostingId === jobId && candidate.status === "selected",
    ).length;
  }

  /** What every hire does: the worker's points and the shift itself. */
  private hire(application: Application, job: JobPosting): void {
    this.grant("worker", application.workerId, "application_selected", `application_selected:${application.id}`);
    if (!this.shifts.some((shift) => shift.applicationId === application.id)) {
      this.shifts.push({
        id: crypto.randomUUID(),
        organizationId: job.organizationId,
        storeId: job.storeId,
        jobPostingId: job.id,
        applicationId: application.id,
        workerId: application.workerId,
        scheduledStartAt: job.startsAt,
        scheduledEndAt: job.endsAt,
        status: "scheduled",
      });
    }
  }

  private transitionJob(
    organizationId: string,
    actorId: string,
    jobId: string,
    from: JobPosting["status"],
    to: JobPosting["status"],
  ): Result<JobPosting> {
    const job = this.jobs.find(
      (candidate) => candidate.id === jobId && candidate.organizationId === organizationId,
    );
    if (!job) return fail("not_found");
    if (job.status !== from) return fail("invalid_transition");
    const before = { ...job };
    job.status = to;
    if (to === "published") job.publishedAt = this.timestamp();
    this.audit(organizationId, actorId, `job_posting.${to}`, "job_posting", job.id, before, job);
    if (to === "published") {
      this.grant("organization", organizationId, "job_published", `job_published:${job.id}`);
    }
    return ok(job);
  }

  private findShift(organizationId: string, shiftId: string): Shift | undefined {
    return this.shifts.find(
      (candidate) => candidate.id === shiftId && candidate.organizationId === organizationId,
    );
  }

  /** The punches that currently count: corrected ones are replaced by their correction, in time order. */
  private effectiveEvents(shiftId: string): AttendanceEvent[] {
    const events = this.attendanceEvents.filter((event) => event.shiftId === shiftId);
    const superseded = new Set(
      events.map((event) => event.correctionOfEventId).filter((id): id is string => id !== null),
    );
    return events
      .filter((event) => !superseded.has(event.id))
      .sort((left, right) => Date.parse(left.recordedAt) - Date.parse(right.recordedAt));
  }

  private isOnBreak(effective: AttendanceEvent[]): boolean {
    const lastBreak = [...effective].reverse().find((event) => event.kind === "break_start" || event.kind === "break_end");
    return lastBreak?.kind === "break_start";
  }

  private summarize(shift: Shift): AttendanceSummary {
    const settings = this.settingsFor(shift.storeId);
    const events = this.effectiveEvents(shift.id);
    const checkIn = events.find((event) => event.kind === "check_in");
    const checkOut = [...events].reverse().find((event) => event.kind === "check_out");
    const scheduledStart = Date.parse(shift.scheduledStartAt);
    const scheduledEnd = Date.parse(shift.scheduledEndAt);
    const now = this.now().getTime();
    const lateMilliseconds = checkIn ? Math.max(0, Date.parse(checkIn.recordedAt) - scheduledStart) : 0;
    const minutesLate = Math.ceil(lateMilliseconds / MINUTE);

    const breaks = this.breakIntervals(events, checkOut ? Date.parse(checkOut.recordedAt) : null);
    const breakMinutes = Math.round(breaks.reduce((sum, interval) => sum + (interval.end - interval.start), 0) / MINUTE);
    const worked: Interval[] =
      checkIn && checkOut
        ? subtractIntervals({ start: Date.parse(checkIn.recordedAt), end: Date.parse(checkOut.recordedAt) }, breaks)
        : [];
    const rawWorkedMinutes = Math.round(worked.reduce((sum, interval) => sum + (interval.end - interval.start), 0) / MINUTE);
    const workedMinutes = Math.floor(rawWorkedMinutes / settings.roundingMinutes) * settings.roundingMinutes;
    const nightMinutes = Math.min(workedMinutes, worked.reduce((sum, interval) => sum + nightMinutesIn(interval), 0));
    const overtimeMinutes = checkOut ? Math.max(0, Math.round((Date.parse(checkOut.recordedAt) - scheduledEnd) / MINUTE)) : 0;
    const requiredBreak =
      [...settings.breakRules]
        .sort((left, right) => right.workedOverMinutes - left.workedOverMinutes)
        .find((rule) => workedMinutes > rule.workedOverMinutes)?.requiredBreakMinutes ?? 0;
    const job = this.jobs.find((candidate) => candidate.id === shift.jobPostingId);
    const wage = job?.hourlyWage ?? 0;
    const beyondLegal = Math.max(0, workedMinutes - LEGAL_DAILY_MINUTES);
    const estimatedPay = Math.round(
      (wage * workedMinutes + wage * settings.nightPremiumRate * nightMinutes + wage * settings.overtimePremiumRate * beyondLegal) / 60,
    );

    const missingPunch: AttendanceSummary["missingPunch"] =
      shift.status === "scheduled" && now >= scheduledStart + MISSING_CHECK_IN_GRACE
        ? "check_in"
        : shift.status === "checked_in" && now >= scheduledEnd + MISSING_CHECK_OUT_GRACE
          ? "check_out"
          : "none";

    return {
      shiftId: shift.id,
      scheduledStartAt: shift.scheduledStartAt,
      scheduledEndAt: shift.scheduledEndAt,
      actualCheckInAt: checkIn?.recordedAt ?? null,
      actualCheckOutAt: checkOut?.recordedAt ?? null,
      punctuality: !checkIn ? "pending" : minutesLate <= PUNCTUAL_GRACE_MINUTES ? "on_time" : "late",
      minutesLate,
      scheduledMinutes: Math.round((scheduledEnd - scheduledStart) / MINUTE),
      workedMinutes,
      breakMinutes,
      overtimeMinutes,
      nightMinutes,
      breakShortfallMinutes: Math.max(0, requiredBreak - breakMinutes),
      estimatedPay,
      onBreak: this.isOnBreak(events),
      missingPunch,
      correctionCount: this.attendanceEvents.filter(
        (event) => event.shiftId === shift.id && event.correctionOfEventId !== null,
      ).length,
    };
  }

  /** Pairs break starts with ends; an open break at check-out closes there. */
  private breakIntervals(events: AttendanceEvent[], checkOutAt: number | null): Interval[] {
    const intervals: Interval[] = [];
    let openStart: number | null = null;
    for (const event of events) {
      if (event.kind === "break_start") openStart = Date.parse(event.recordedAt);
      if (event.kind === "break_end" && openStart !== null) {
        intervals.push({ start: openStart, end: Date.parse(event.recordedAt) });
        openStart = null;
      }
    }
    if (openStart !== null && checkOutAt !== null) intervals.push({ start: openStart, end: checkOutAt });
    return intervals;
  }

  /** Grants a reward once per event key and recomputes level and unlocked items. */
  private grant(
    ownerType: GameWorld["ownerType"],
    ownerId: string,
    code: RewardCode,
    eventKey: string,
    grantedAt: string = this.timestamp(),
  ): void {
    if (this.rewardGrants.some((grant) => grant.eventKey === eventKey)) return;
    const experience = rewardExperience(code);
    const world = this.getWorld(ownerType, ownerId);
    world.experience += experience;
    const { level, unlocks } = levelFor(world.kind, world.experience);
    world.level = level;
    for (const item of unlocks) {
      if (!(item in world.inventory)) world.inventory[item] = 1;
    }
    if (Date.parse(grantedAt) > Date.parse(world.updatedAt)) world.updatedAt = grantedAt;
    this.rewardGrants.push({
      id: crypto.randomUUID(),
      ownerType,
      ownerId,
      eventKey,
      rewardCode: code,
      experience,
      grantedAt,
    });
    this.changed();
  }

  private audit(
    organizationId: string,
    actorId: string,
    action: string,
    entityType: AuditLogEntry["entityType"],
    entityId: string,
    before: unknown,
    after: unknown,
  ): void {
    this.auditLogs.push({
      id: this.auditLogs.length + 1,
      organizationId,
      actorId,
      action,
      entityType,
      entityId,
      before: structuredClone(before),
      after: structuredClone(after),
      createdAt: this.timestamp(),
    });
    this.changed();
  }

  private changed(): void {
    for (const listener of this.changeListeners) listener();
  }

  private timestamp(): string {
    return this.now().toISOString();
  }
}

function subtractIntervals(base: Interval, holes: Interval[]): Interval[] {
  let remaining: Interval[] = [base];
  for (const hole of holes) {
    remaining = remaining.flatMap((interval) => {
      const start = Math.max(interval.start, hole.start);
      const end = Math.min(interval.end, hole.end);
      if (start >= end) return [interval];
      const pieces: Interval[] = [];
      if (interval.start < start) pieces.push({ start: interval.start, end: start });
      if (end < interval.end) pieces.push({ start: end, end: interval.end });
      return pieces;
    });
  }
  return remaining;
}

/** Minutes of an interval that fall between 22:00 and 05:00 Japan time. */
function nightMinutesIn(interval: Interval): number {
  let minutes = 0;
  for (let time = interval.start; time < interval.end; time += MINUTE) {
    const hour = Math.floor(((time + JST_OFFSET) % DAY) / HOUR);
    if (hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR) minutes += 1;
  }
  return minutes;
}

/** 2026-09 in Japan time. */
export function jstMonthKey(epochMilliseconds: number): string {
  return new Date(epochMilliseconds + JST_OFFSET).toISOString().slice(0, 7);
}

function addMinutes(timestamp: string, minutes: number): string {
  return new Date(Date.parse(timestamp) + minutes * MINUTE).toISOString();
}

function toJstTimestamp(epochMilliseconds: number): string {
  return new Date(epochMilliseconds + JST_OFFSET).toISOString().replace(/\.\d{3}Z$/, "+09:00");
}

/** The store the routes use. `replaceStore` swaps in one loaded from a snapshot at boot. */
export let store = new MemoryStore();

export function replaceStore(next: MemoryStore): void {
  store = next;
}
