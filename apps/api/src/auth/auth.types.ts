import { UserRole } from "@prisma/client";

export type AuthUser = {
  id: number;
  email: string;
  role: UserRole;
  organizerId?: number | null;
};
