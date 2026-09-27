import type {
  Application,
  AttendanceEvent,
  ClosedPeriod,
  ShopReviewTag,
  Evaluation,
  GameWorld,
  Invitation,
  JobPosting,
  Letter,
  Member,
  RewardCode,
  Shift,
  ShopFeedback,
  Store,
  StoreSettings,
  WorkerActivity,
} from "@paw-time/api-contracts";
import { letterTemplateBody } from "@paw-time/api-contracts";

export const DEMO_ORGANIZATION_ID = "org-komorebi";
export const DEMO_STORE_ID = "store-komorebi";
export const DEMO_ANNEX_STORE_ID = "store-komorebi-annex";
export const DEMO_ACTOR_ID = "member-demo";
export const DEMO_STAFF_ID = "member-staff";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const JST_OFFSET = 9 * HOUR;

export type SeedReward = {
  ownerType: GameWorld["ownerType"];
  ownerId: string;
  code: RewardCode;
  eventKey: string;
  grantedAt: string;
};

export type SeedData = {
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
  rewards: SeedReward[];
};

export function toJstTimestamp(epochMilliseconds: number): string {
  return new Date(epochMilliseconds + JST_OFFSET).toISOString().replace(/\.\d{3}Z$/, "+09:00");
}

type DemoSlot = {
  jobId: string;
  storeId?: string;
  title: string;
  description: string;
  role: JobPosting["role"];
  hourlyWage: number;
  capacity: number;
  startsAt: number;
  endsAt: number;
  status: JobPosting["status"];
};

type DemoHire = {
  slot: DemoSlot;
  /** Used in ids; `workerKey` overrides the worker id so one worker can have several shifts. */
  key: string;
  workerKey?: string;
  displayName: string;
  checkInOffsetMinutes?: number;
  checkOutOffsetMinutes?: number;
  /** Break as [minutes after start, length in minutes]. */
  breakAt?: [number, number];
  shiftStatus: Shift["status"];
  /** Shifts from before the island existed earn no points. */
  historical?: boolean;
  /** The worker's ten-second review of the shop afterwards: stars and the tags that applied. */
  feedback?: [stars: number, tags: ShopReviewTag[]];
  /** Opened the worker app this many hours after the shift ended. */
  openedAfterHours?: number;
  visitedIsland?: boolean;
};

/**
 * Demo data for the in-memory API. Times are relative to `now` in JST so the
 * dashboard always has a shift in progress, one waiting to start, one waiting
 * for confirmation and one waiting for an evaluation. Last month holds a
 * closed, confirmed history so the roster, the signals and the shop's review
 * summary have something to show.
 */
export function createSeed(now: Date): SeedData {
  const nowMs = now.getTime();
  const currentHour = Math.floor(nowMs / HOUR) * HOUR;
  const todayStart = Math.floor((nowMs + JST_OFFSET) / DAY) * DAY - JST_OFFSET;
  const dayAt = (offsetDays: number, hours: number) => todayStart + offsetDays * DAY + hours * HOUR;
  const at = toJstTimestamp;

  // Island looks mirror the worker app's "cafe" style: teal signboard, cream awning stripes.
  const stores: Store[] = [
    {
      id: DEMO_STORE_ID,
      organizationId: DEMO_ORGANIZATION_ID,
      name: "リクルート 社内カフェ（仮）",
      timezone: "Asia/Tokyo",
      logoUrl: "/logo/komorebi.svg",
      signColor: "#5fb7a8",
      accentColor: "#fdf7ee",
      values: "あわてないペースと、あたたかい一杯を。",
    },
    {
      id: DEMO_ANNEX_STORE_ID,
      organizationId: DEMO_ORGANIZATION_ID,
      name: "リクルート 社内カフェ 2号店（仮）",
      timezone: "Asia/Tokyo",
      logoUrl: "/logo/komorebi.svg",
      signColor: "#4f9bd6",
      accentColor: "#f4fbff",
      values: "だれでも初日から動ける、はっきりした手順。",
    },
  ];
  const members: Member[] = [
    { id: DEMO_ACTOR_ID, organizationId: DEMO_ORGANIZATION_ID, displayName: "さくらい（店長）", role: "manager" },
    { id: DEMO_STAFF_ID, organizationId: DEMO_ORGANIZATION_ID, displayName: "みなと（スタッフ）", role: "staff" },
  ];

  const hall: DemoSlot = {
    jobId: "job-demo-hall",
    title: "ホールスタッフ",
    description: "ご案内、注文のお伺い、配膳をお願いします。",
    role: "hall",
    hourlyWage: 1250,
    capacity: 2,
    startsAt: currentHour - 2 * HOUR,
    endsAt: currentHour + 2 * HOUR,
    status: "published",
  };
  const kitchen: DemoSlot = {
    jobId: "job-demo-kitchen",
    title: "キッチン補助",
    description: "野菜の下ごしらえと盛り付けの補助をお願いします。",
    role: "kitchen",
    hourlyWage: 1300,
    capacity: 1,
    startsAt: currentHour + 2 * HOUR,
    endsAt: currentHour + 6 * HOUR,
    status: "published",
  };
  const dish: DemoSlot = {
    jobId: "job-demo-dish",
    title: "洗い場スタッフ",
    description: "ディナー営業中の食器洗いと片付けをお願いします。",
    role: "dish",
    hourlyWage: 1200,
    capacity: 2,
    startsAt: dayAt(-1, 17),
    endsAt: dayAt(-1, 22),
    status: "closed",
  };
  const register: DemoSlot = {
    jobId: "job-demo-register",
    title: "レジと会計",
    description: "レジ打ちとテイクアウトの受け渡しをお願いします。",
    role: "register",
    hourlyWage: 1250,
    capacity: 1,
    startsAt: dayAt(-2, 10),
    endsAt: dayAt(-2, 15),
    status: "closed",
  };
  const stock: DemoSlot = {
    jobId: "job-demo-stock",
    title: "品出しと在庫整理",
    description: "焼き菓子の品出しと倉庫の在庫整理をお願いします。",
    role: "stock",
    hourlyWage: 1150,
    capacity: 1,
    startsAt: dayAt(-3, 13),
    endsAt: dayAt(-3, 17),
    status: "closed",
  };
  const lunch: DemoSlot = {
    jobId: "job-demo-lunch",
    title: "ランチのホール",
    description: "ランチタイムのご案内と配膳をお願いします。",
    role: "hall",
    hourlyWage: 1250,
    capacity: 2,
    startsAt: dayAt(-6, 11),
    endsAt: dayAt(-6, 15),
    status: "closed",
  };
  const morning: DemoSlot = {
    jobId: "job-demo-morning",
    title: "モーニングの仕込み",
    description: "開店前のパン出しとドリンクの準備をお願いします。",
    role: "kitchen",
    hourlyWage: 1350,
    capacity: 2,
    startsAt: dayAt(5, 7),
    endsAt: dayAt(5, 11),
    status: "draft",
  };
  const annexHall: DemoSlot = {
    jobId: "job-demo-annex-hall",
    storeId: DEMO_ANNEX_STORE_ID,
    title: "2号店 ホールスタッフ",
    description: "2号店のランチタイムのご案内と配膳をお願いします。",
    role: "hall",
    hourlyWage: 1300,
    capacity: 2,
    startsAt: dayAt(1, 10),
    endsAt: dayAt(1, 15),
    status: "published",
  };
  // Last month: confirmed, closed history from before the island existed.
  const pastDinner: DemoSlot = {
    jobId: "job-demo-past-dinner",
    title: "ディナーのホール",
    description: "ディナータイムのご案内と配膳をお願いします。",
    role: "hall",
    hourlyWage: 1250,
    capacity: 2,
    startsAt: dayAt(-28, 17),
    endsAt: dayAt(-28, 22),
    status: "closed",
  };
  const pastRegister: DemoSlot = {
    jobId: "job-demo-past-register",
    title: "レジと会計",
    description: "レジ打ちとテイクアウトの受け渡しをお願いします。",
    role: "register",
    hourlyWage: 1250,
    capacity: 1,
    startsAt: dayAt(-29, 10),
    endsAt: dayAt(-29, 15),
    status: "closed",
  };
  const pastStock: DemoSlot = {
    jobId: "job-demo-past-stock",
    title: "品出しと在庫整理",
    description: "焼き菓子の品出しと倉庫の在庫整理をお願いします。",
    role: "stock",
    hourlyWage: 1150,
    capacity: 1,
    startsAt: dayAt(-31, 13),
    endsAt: dayAt(-31, 17),
    status: "closed",
  };
  const pastLunch: DemoSlot = {
    jobId: "job-demo-past-lunch",
    title: "ランチのホール",
    description: "ランチタイムのご案内と配膳をお願いします。",
    role: "hall",
    hourlyWage: 1250,
    capacity: 1,
    startsAt: dayAt(-34, 11),
    endsAt: dayAt(-34, 15),
    status: "closed",
  };
  const pastMorning: DemoSlot = {
    jobId: "job-demo-past-morning",
    title: "モーニングの仕込み",
    description: "開店前のパン出しとドリンクの準備をお願いします。",
    role: "kitchen",
    hourlyWage: 1350,
    capacity: 1,
    startsAt: dayAt(-38, 7),
    endsAt: dayAt(-38, 11),
    status: "closed",
  };

  const slots = [hall, kitchen, dish, register, stock, lunch, morning, annexHall, pastDinner, pastRegister, pastStock, pastLunch, pastMorning];
  const jobs: JobPosting[] = [
    {
      id: "job-komorebi-20261003",
      organizationId: DEMO_ORGANIZATION_ID,
      storeId: DEMO_STORE_ID,
      title: "カフェのホールスタッフ",
      description: "注文のお伺い、配膳、片付けをお願いします。",
      role: "hall",
      hourlyWage: 1300,
      startsAt: "2026-10-03T10:00:00+09:00",
      endsAt: "2026-10-03T15:00:00+09:00",
      capacity: 3,
      status: "published",
      urgent: false,
      publishedAt: "2026-09-26T09:00:00+09:00",
      createdAt: "2026-09-26T09:00:00+09:00",
    },
    ...slots.map((slot): JobPosting => {
      const createdAt = at(slot.status === "draft" ? nowMs - HOUR : slot.startsAt - 5 * DAY);
      return {
        id: slot.jobId,
        organizationId: DEMO_ORGANIZATION_ID,
        storeId: slot.storeId ?? DEMO_STORE_ID,
        title: slot.title,
        description: slot.description,
        role: slot.role,
        hourlyWage: slot.hourlyWage,
        startsAt: at(slot.startsAt),
        endsAt: at(slot.endsAt),
        capacity: slot.capacity,
        status: slot.status,
        urgent: false,
        publishedAt: slot.status === "draft" ? null : createdAt,
        createdAt,
      };
    }),
  ];

  const applications: Application[] = [
    pendingApplication("application-demo-1", "job-komorebi-20261003", "mika", "みか", at(nowMs - 3 * HOUR)),
    pendingApplication("application-demo-haruto", hall.jobId, "haruto", "はると", at(nowMs - HOUR)),
    pendingApplication("application-demo-tsumugi", "job-komorebi-20261003", "tsumugi", "つむぎ", at(nowMs - 26 * HOUR)),
    pendingApplication("application-demo-sora", annexHall.jobId, "sora", "そら", at(nowMs - 5 * HOUR)),
    {
      id: "application-demo-ren",
      organizationId: DEMO_ORGANIZATION_ID,
      jobPostingId: dish.jobId,
      workerId: "worker-demo-ren",
      workerDisplayName: "れん",
      status: "rejected",
      appliedAt: at(dish.startsAt - 3 * DAY),
      decidedAt: at(dish.startsAt - 2 * DAY),
      decisionNote: "定員に達したため",
    },
    // Hired for the dish shift, then withdrew five hours before it: a last-minute cancellation.
    {
      id: "application-demo-mio",
      organizationId: DEMO_ORGANIZATION_ID,
      jobPostingId: dish.jobId,
      workerId: "worker-demo-mio",
      workerDisplayName: "みお",
      status: "withdrawn",
      appliedAt: at(dish.startsAt - 3 * DAY),
      decidedAt: at(dish.startsAt - 5 * HOUR),
      decisionNote: null,
    },
  ];
  const shifts: Shift[] = [
    {
      id: "shift-demo-mio",
      organizationId: DEMO_ORGANIZATION_ID,
      storeId: DEMO_STORE_ID,
      jobPostingId: dish.jobId,
      applicationId: "application-demo-mio",
      workerId: "worker-demo-mio",
      scheduledStartAt: at(dish.startsAt),
      scheduledEndAt: at(dish.endsAt),
      status: "cancelled",
    },
  ];

  const hires: DemoHire[] = [
    { slot: hall, key: "yu", displayName: "ゆう", checkInOffsetMinutes: 2, shiftStatus: "checked_in" },
    { slot: kitchen, key: "rin", displayName: "りん", shiftStatus: "scheduled" },
    {
      slot: dish,
      key: "koharu",
      displayName: "こはる",
      checkInOffsetMinutes: 12,
      checkOutOffsetMinutes: 4,
      breakAt: [120, 30],
      shiftStatus: "checked_out",
      feedback: [4, ["breaks", "friendly"]],
    },
    {
      slot: register,
      key: "sota",
      displayName: "そうた",
      checkInOffsetMinutes: -5,
      checkOutOffsetMinutes: 2,
      breakAt: [150, 30],
      shiftStatus: "completed",
      feedback: [5, ["on_time", "paid", "friendly", "again"]],
      openedAfterHours: 18,
    },
    {
      slot: stock,
      key: "aoi",
      displayName: "あおい",
      checkInOffsetMinutes: 1,
      checkOutOffsetMinutes: 0,
      shiftStatus: "completed",
      feedback: [5, ["on_time", "instructions", "paid", "again"]],
      openedAfterHours: 16,
      visitedIsland: true,
    },
    {
      slot: lunch,
      key: "haruto-lunch",
      workerKey: "haruto",
      displayName: "はると",
      checkInOffsetMinutes: -3,
      checkOutOffsetMinutes: 5,
      breakAt: [120, 20],
      shiftStatus: "completed",
      feedback: [4, ["breaks", "friendly", "again"]],
      openedAfterHours: 20,
      visitedIsland: true,
    },
    { slot: lunch, key: "tsumugi-lunch", workerKey: "tsumugi", displayName: "つむぎ", shiftStatus: "no_show" },
    // Last month
    {
      slot: pastDinner,
      key: "nagi-dinner",
      workerKey: "nagi",
      displayName: "なぎ",
      checkInOffsetMinutes: -2,
      checkOutOffsetMinutes: 3,
      breakAt: [150, 45],
      shiftStatus: "completed",
      historical: true,
      feedback: [5, ["on_time", "breaks", "paid", "friendly", "again"]],
      openedAfterHours: 14,
      visitedIsland: true,
    },
    {
      slot: pastDinner,
      key: "hikari-dinner",
      workerKey: "hikari",
      displayName: "ひかり",
      checkInOffsetMinutes: 8,
      checkOutOffsetMinutes: 0,
      breakAt: [150, 45],
      shiftStatus: "completed",
      historical: true,
      feedback: [3, ["paid"]],
    },
    {
      slot: pastRegister,
      key: "yui-register",
      workerKey: "yui",
      displayName: "ゆい",
      checkInOffsetMinutes: 0,
      checkOutOffsetMinutes: 1,
      breakAt: [150, 30],
      shiftStatus: "completed",
      historical: true,
      openedAfterHours: 22,
    },
    {
      slot: pastStock,
      key: "aoi-past",
      workerKey: "aoi",
      displayName: "あおい",
      checkInOffsetMinutes: 2,
      checkOutOffsetMinutes: 0,
      shiftStatus: "completed",
      historical: true,
      openedAfterHours: 15,
    },
    {
      slot: pastLunch,
      key: "haruto-past",
      workerKey: "haruto",
      displayName: "はると",
      checkInOffsetMinutes: -1,
      checkOutOffsetMinutes: 3,
      breakAt: [120, 20],
      shiftStatus: "completed",
      historical: true,
      openedAfterHours: 12,
    },
    {
      slot: pastMorning,
      key: "kei-morning",
      workerKey: "kei",
      displayName: "けい",
      checkInOffsetMinutes: -4,
      checkOutOffsetMinutes: 0,
      shiftStatus: "completed",
      historical: true,
      feedback: [5, ["on_time", "instructions", "friendly", "fair", "again"]],
      openedAfterHours: 30,
    },
  ];

  const attendanceEvents: AttendanceEvent[] = [];
  const shopFeedback: ShopFeedback[] = [];
  const workerActivities: WorkerActivity[] = [];
  const rewards: SeedReward[] = jobs
    .filter((job) => job.status !== "draft" && !job.id.startsWith("job-demo-past-"))
    .map((job) => ({
      ownerType: "organization",
      ownerId: DEMO_ORGANIZATION_ID,
      code: "job_published",
      eventKey: `job_published:${job.id}`,
      grantedAt: job.createdAt,
    }));

  const punch = (
    hire: DemoHire,
    shiftId: string,
    workerId: string,
    suffix: string,
    kind: AttendanceEvent["kind"],
    recordedAt: number,
  ): AttendanceEvent => ({
    id: `attendance-demo-${hire.key}-${suffix}`,
    organizationId: DEMO_ORGANIZATION_ID,
    shiftId,
    kind,
    recordedAt: at(recordedAt),
    source: "worker",
    actorId: workerId,
    clientRequestId: `seed-${hire.key}-${suffix}`,
    correctionOfEventId: null,
    note: null,
  });

  for (const hire of hires) {
    const workerId = `worker-demo-${hire.workerKey ?? hire.key}`;
    const applicationId = `application-demo-${hire.key}`;
    const shiftId = `shift-demo-${hire.key}`;
    const appliedAt = hire.slot.startsAt - 3 * DAY;
    const decidedAt = appliedAt + (hire.historical ? 6 : 30) * HOUR;
    applications.push({
      id: applicationId,
      organizationId: DEMO_ORGANIZATION_ID,
      jobPostingId: hire.slot.jobId,
      workerId,
      workerDisplayName: hire.displayName,
      status: "selected",
      appliedAt: at(appliedAt),
      decidedAt: at(decidedAt),
      decisionNote: null,
    });
    if (!hire.historical) {
      rewards.push({
        ownerType: "worker",
        ownerId: workerId,
        code: "application_selected",
        eventKey: `application_selected:${applicationId}`,
        grantedAt: at(decidedAt),
      });
    }
    shifts.push({
      id: shiftId,
      organizationId: DEMO_ORGANIZATION_ID,
      storeId: hire.slot.storeId ?? DEMO_STORE_ID,
      jobPostingId: hire.slot.jobId,
      applicationId,
      workerId,
      scheduledStartAt: at(hire.slot.startsAt),
      scheduledEndAt: at(hire.slot.endsAt),
      status: hire.shiftStatus,
    });
    if (hire.checkInOffsetMinutes !== undefined) {
      attendanceEvents.push(punch(hire, shiftId, workerId, "in", "check_in", hire.slot.startsAt + hire.checkInOffsetMinutes * MINUTE));
    }
    if (hire.breakAt) {
      const [afterMinutes, lengthMinutes] = hire.breakAt;
      const breakStart = hire.slot.startsAt + afterMinutes * MINUTE;
      attendanceEvents.push(
        punch(hire, shiftId, workerId, "break-start", "break_start", breakStart),
        punch(hire, shiftId, workerId, "break-end", "break_end", breakStart + lengthMinutes * MINUTE),
      );
    }
    if (hire.checkOutOffsetMinutes !== undefined) {
      attendanceEvents.push(punch(hire, shiftId, workerId, "out", "check_out", hire.slot.endsAt + hire.checkOutOffsetMinutes * MINUTE));
    }
    if (hire.shiftStatus === "completed" && !hire.historical) {
      const confirmedAt = at(hire.slot.endsAt + HOUR);
      rewards.push(
        {
          ownerType: "organization",
          ownerId: DEMO_ORGANIZATION_ID,
          code: "attendance_confirmed",
          eventKey: `attendance_confirmed:${shiftId}`,
          grantedAt: confirmedAt,
        },
        {
          ownerType: "worker",
          ownerId: workerId,
          code: "shift_completed",
          eventKey: `shift_completed:${shiftId}`,
          grantedAt: confirmedAt,
        },
      );
    }
    if (hire.feedback) {
      const [stars, tags] = hire.feedback;
      shopFeedback.push({
        id: `feedback-demo-${hire.key}`,
        organizationId: DEMO_ORGANIZATION_ID,
        storeId: hire.slot.storeId ?? DEMO_STORE_ID,
        shiftId,
        workerId,
        stars,
        tags,
        submittedAt: at(hire.slot.endsAt + 2 * HOUR),
      });
    }
    if (hire.openedAfterHours !== undefined) {
      workerActivities.push({
        id: `activity-demo-${hire.key}-open`,
        workerId,
        organizationId: null,
        kind: "app_opened",
        occurredAt: at(hire.slot.endsAt + hire.openedAfterHours * HOUR),
      });
    }
    if (hire.visitedIsland) {
      workerActivities.push({
        id: `activity-demo-${hire.key}-island`,
        workerId,
        organizationId: DEMO_ORGANIZATION_ID,
        kind: "island_visited",
        occurredAt: at(hire.slot.endsAt + (hire.openedAfterHours ?? 12) * HOUR + 10 * MINUTE),
      });
    }
  }

  // Reviews from the months before the demo window, so the island has grown like the worker app's sample shop.
  // Together with the seven above: on time 23, breaks 14, instructions 8, paid 16, friendly 21, fair 3, again 20 (37 reviews).
  const sampleReviews: Array<[stars: number, tags: ShopReviewTag[]]> = [
    [5, ["on_time", "friendly", "again"]], [4, ["on_time", "paid"]], [5, ["on_time", "breaks", "friendly", "again"]],
    [4, ["on_time", "paid", "again"]], [5, ["on_time", "friendly"]], [4, ["breaks", "paid", "again"]],
    [5, ["on_time", "friendly", "again"]], [4, ["on_time", "instructions"]], [5, ["on_time", "paid", "friendly", "again"]],
    [4, ["breaks", "friendly"]], [5, ["on_time", "again"]], [3, ["paid"]],
    [5, ["on_time", "breaks", "friendly", "again"]], [4, ["on_time", "instructions", "paid"]], [5, ["friendly", "again"]],
    [4, ["on_time", "breaks"]], [5, ["on_time", "paid", "friendly", "again"]], [4, ["instructions", "friendly"]],
    [5, ["on_time", "breaks", "again"]], [4, ["paid", "friendly"]], [5, ["on_time", "breaks", "friendly", "again"]],
    [4, ["on_time", "instructions", "paid"]], [5, ["friendly", "again"]], [4, ["breaks", "paid"]],
    [5, ["on_time", "friendly", "fair", "again"]], [4, ["breaks", "instructions"]], [5, ["on_time", "paid", "friendly"]],
    [4, ["breaks", "again"]], [5, ["on_time", "friendly", "fair"]], [4, ["breaks", "paid", "instructions"]],
  ];
  sampleReviews.forEach(([stars, tags], index) => {
    shopFeedback.push({
      id: `feedback-sample-${index + 1}`,
      organizationId: DEMO_ORGANIZATION_ID,
      storeId: DEMO_STORE_ID,
      shiftId: `shift-sample-${index + 1}`,
      workerId: `worker-sample-${index + 1}`,
      stars,
      tags,
      submittedAt: at(dayAt(-45 - index * 2, 20)),
    });
  });
  // Two early answers at the annex: not enough to show anything yet.
  const annexReviews: Array<[stars: number, tags: ShopReviewTag[]]> = [[5, ["friendly", "again"]], [4, ["instructions"]]];
  annexReviews.forEach(([stars, tags], index) => {
    shopFeedback.push({
      id: `feedback-annex-${index + 1}`,
      organizationId: DEMO_ORGANIZATION_ID,
      storeId: DEMO_ANNEX_STORE_ID,
      shiftId: `shift-annex-sample-${index + 1}`,
      workerId: `worker-sample-annex-${index + 1}`,
      stars,
      tags,
      submittedAt: at(dayAt(-20 - index * 3, 19)),
    });
  });

  const evaluations: Evaluation[] = [
    {
      id: "evaluation-demo-haruto-lunch",
      organizationId: DEMO_ORGANIZATION_ID,
      shiftId: "shift-demo-haruto-lunch",
      authorId: DEMO_ACTOR_ID,
      subjectType: "worker",
      subjectId: "worker-demo-haruto",
      rating: 4,
      tags: ["on_time", "smile"],
      comment: "お客さんへの声かけが自然でした。",
      submittedAt: at(lunch.endsAt + 3 * HOUR),
    },
    {
      id: "evaluation-demo-aoi",
      organizationId: DEMO_ORGANIZATION_ID,
      shiftId: "shift-demo-aoi",
      authorId: DEMO_ACTOR_ID,
      subjectType: "worker",
      subjectId: "worker-demo-aoi",
      rating: 5,
      tags: ["on_time", "careful"],
      comment: "品出しがとても丁寧で、棚がきれいになりました。",
      submittedAt: at(stock.endsAt + 2 * HOUR),
    },
    {
      id: "evaluation-demo-nagi-dinner",
      organizationId: DEMO_ORGANIZATION_ID,
      shiftId: "shift-demo-nagi-dinner",
      authorId: DEMO_ACTOR_ID,
      subjectType: "worker",
      subjectId: "worker-demo-nagi",
      rating: 5,
      tags: ["efficient", "teamwork", "come_again"],
      comment: "ピークの回し方が見事でした。",
      submittedAt: at(pastDinner.endsAt + 2 * HOUR),
    },
    {
      id: "evaluation-demo-hikari-dinner",
      organizationId: DEMO_ORGANIZATION_ID,
      shiftId: "shift-demo-hikari-dinner",
      authorId: DEMO_ACTOR_ID,
      subjectType: "worker",
      subjectId: "worker-demo-hikari",
      rating: 3,
      tags: ["careful"],
      comment: "遅刻はありましたが、作業はていねいでした。",
      submittedAt: at(pastDinner.endsAt + 2 * HOUR),
    },
    {
      id: "evaluation-demo-kei-morning",
      organizationId: DEMO_ORGANIZATION_ID,
      shiftId: "shift-demo-kei-morning",
      authorId: DEMO_ACTOR_ID,
      subjectType: "worker",
      subjectId: "worker-demo-kei",
      rating: 4,
      tags: ["on_time", "efficient"],
      comment: "仕込みが速く、開店に余裕ができました。",
      submittedAt: at(pastMorning.endsAt + HOUR),
    },
  ];
  rewards.push(
    {
      ownerType: "organization",
      ownerId: DEMO_ORGANIZATION_ID,
      code: "evaluation_submitted",
      eventKey: "evaluation_submitted:evaluation-demo-aoi",
      grantedAt: at(stock.endsAt + 2 * HOUR),
    },
    {
      ownerType: "organization",
      ownerId: DEMO_ORGANIZATION_ID,
      code: "evaluation_submitted",
      eventKey: "evaluation_submitted:evaluation-demo-haruto-lunch",
      grantedAt: at(lunch.endsAt + 3 * HOUR),
    },
  );

  const letters: Letter[] = [
    {
      id: "letter-demo-aoi",
      organizationId: DEMO_ORGANIZATION_ID,
      shiftId: "shift-demo-aoi",
      workerId: "worker-demo-aoi",
      authorId: DEMO_ACTOR_ID,
      template: "thank_you",
      body: letterTemplateBody("thank_you"),
      sentAt: at(stock.endsAt + 2 * HOUR + 10 * MINUTE),
      replyStamp: "thanks",
      repliedAt: at(stock.endsAt + 16 * HOUR + 5 * MINUTE),
    },
    {
      id: "letter-demo-haruto-lunch",
      organizationId: DEMO_ORGANIZATION_ID,
      shiftId: "shift-demo-haruto-lunch",
      workerId: "worker-demo-haruto",
      authorId: DEMO_ACTOR_ID,
      template: "come_again",
      body: letterTemplateBody("come_again"),
      sentAt: at(lunch.endsAt + 3 * HOUR + 5 * MINUTE),
      replyStamp: "see_you",
      repliedAt: at(lunch.endsAt + 20 * HOUR + 30 * MINUTE),
    },
  ];
  rewards.push(
    {
      ownerType: "organization",
      ownerId: DEMO_ORGANIZATION_ID,
      code: "letter_sent",
      eventKey: "letter_sent:shift-demo-aoi",
      grantedAt: at(stock.endsAt + 2 * HOUR + 10 * MINUTE),
    },
    {
      ownerType: "organization",
      ownerId: DEMO_ORGANIZATION_ID,
      code: "letter_sent",
      eventKey: "letter_sent:shift-demo-haruto-lunch",
      grantedAt: at(lunch.endsAt + 3 * HOUR + 5 * MINUTE),
    },
  );

  const previousMonth = new Date(todayStart + JST_OFFSET);
  previousMonth.setUTCDate(1);
  previousMonth.setUTCMonth(previousMonth.getUTCMonth() - 1);
  const closedPeriods: ClosedPeriod[] = [
    {
      id: "closed-demo-previous-month",
      organizationId: DEMO_ORGANIZATION_ID,
      storeId: DEMO_STORE_ID,
      month: previousMonth.toISOString().slice(0, 7),
      closedAt: at(dayAt(-Math.min(20, new Date(todayStart + JST_OFFSET).getUTCDate() + 4), 18)),
      closedBy: DEMO_ACTOR_ID,
    },
  ];

  return {
    stores,
    members,
    storeSettings: [],
    jobs,
    applications,
    shifts,
    attendanceEvents,
    evaluations,
    letters,
    invitations: [],
    closedPeriods,
    shopFeedback,
    workerActivities,
    rewards,
  };
}

function pendingApplication(
  id: string,
  jobPostingId: string,
  workerKey: string,
  workerDisplayName: string,
  appliedAt: string,
): Application {
  return {
    id,
    organizationId: DEMO_ORGANIZATION_ID,
    jobPostingId,
    workerId: `worker-demo-${workerKey}`,
    workerDisplayName,
    status: "applied",
    appliedAt,
    decidedAt: null,
    decisionNote: null,
  };
}
