import type { MemberRole } from "@paw-time/api-contracts";

export type AppEnv = {
  Variables: {
    organizationId: string;
    actorId: string;
    role: MemberRole;
  };
};
