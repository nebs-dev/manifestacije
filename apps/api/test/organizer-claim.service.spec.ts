import { BadRequestException } from "@nestjs/common";
import { OrganizerStatus, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { OrganizerClaimService } from "../src/organizer-claims/organizer-claim.service";

const GENERIC_MESSAGE = "Ako je moguće potvrditi zahtjev, poslali smo vam poveznicu na unesenu adresu.";
const INVALID_CLAIM_MESSAGE = "Poveznica za preuzimanje profila nije valjana ili je istekla.";

function emailMock(overrides: Record<string, unknown> = {}) {
  return {
    webUrl: "https://manifestacije.hr",
    organizerClaimUrl: "https://manifestacije.hr/preuzmi-profil",
    organizerClaimTokenTtlMinutes: 30,
    sendOrganizerClaim: jest.fn().mockResolvedValue({ provider: "log" }),
    sendAdminNewSubmission: jest.fn().mockResolvedValue(undefined),
    sendAdminNewOrganizer: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function contactsMock(overrides: Record<string, unknown> = {}) {
  return {
    syncClaimedOrganizer: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function organizer(overrides: Record<string, unknown> = {}) {
  return { id: 7, name: "Test Organizer", slug: "test-organizer", email: "organizer@example.hr", status: OrganizerStatus.UNCLAIMED, users: [], ...overrides };
}

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    organizer: { findUnique: jest.fn().mockResolvedValue(organizer()), findFirst: jest.fn().mockResolvedValue(organizer()) },
    organizerClaim: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({ id: 1 }),
      delete: jest.fn().mockResolvedValue({ id: 1 }),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    user: { findUnique: jest.fn().mockResolvedValue(null) },
    ...overrides,
  };
}

describe("OrganizerClaimService.requestClaim", () => {
  it("returns the identical generic message whether or not the organizer exists", async () => {
    const prisma = makePrisma({ organizer: { findUnique: jest.fn().mockResolvedValue(null) } });
    const service = new OrganizerClaimService(prisma as never, emailMock() as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    const result = await service.requestClaim({ organizerSlug: "nope", email: "a@example.hr" });

    expect(result).toEqual({ message: GENERIC_MESSAGE });
  });

  it("does nothing when the organizer does not exist", async () => {
    const prisma = makePrisma({ organizer: { findUnique: jest.fn().mockResolvedValue(null) } });
    const email = emailMock();
    const service = new OrganizerClaimService(prisma as never, email as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.requestClaim({ organizerSlug: "nope", email: "a@example.hr" });

    expect(prisma.organizerClaim.create).not.toHaveBeenCalled();
    expect(email.sendOrganizerClaim).not.toHaveBeenCalled();
  });

  it("takes the automatic path and emails a hashed claim token when the email exactly matches the stored organizer email", async () => {
    const prisma = makePrisma();
    const email = emailMock();
    const contacts = contactsMock();
    const service = new OrganizerClaimService(prisma as never, email as never, contacts as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    const result = await service.requestClaim({ organizerSlug: "test-organizer", email: "organizer@example.hr" });

    expect(result).toEqual({ message: GENERIC_MESSAGE });
    expect(email.sendOrganizerClaim).toHaveBeenCalledTimes(1);
    // A pending request never syncs a Resend Contact — only a completed claim does.
    expect(contacts.syncClaimedOrganizer).not.toHaveBeenCalled();
    const createArgs = prisma.organizerClaim.create.mock.calls[0][0];
    expect(createArgs.data.status).toBe("EMAIL_VERIFICATION_SENT");
    // Raw token only ever appears in the emailed URL — never stored directly.
    const [, data] = email.sendOrganizerClaim.mock.calls[0];
    const rawTokenFromUrl = decodeURIComponent(data.claimUrl.split("token=")[1]);
    expect(createHash("sha256").update(rawTokenFromUrl).digest("hex")).toBe(createArgs.data.tokenHash);
    expect(createArgs.data.tokenHash).not.toBe(rawTokenFromUrl);
  });

  it("takes the admin-review path and does not email the submitter when the email does not match", async () => {
    const prisma = makePrisma();
    const email = emailMock();
    const service = new OrganizerClaimService(prisma as never, email as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    const result = await service.requestClaim({ organizerSlug: "test-organizer", email: "someone-else@example.hr" });

    expect(result).toEqual({ message: GENERIC_MESSAGE });
    expect(email.sendOrganizerClaim).not.toHaveBeenCalled();
    expect(email.sendAdminNewSubmission).toHaveBeenCalledTimes(1);
    const createArgs = prisma.organizerClaim.create.mock.calls[0][0];
    expect(createArgs.data.status).toBe("NEEDS_ADMIN_REVIEW");
    expect(createArgs.data.tokenHash).toBeUndefined();
  });

  it("takes the admin-review path when the organizer is already claimed, even on an exact email match", async () => {
    const prisma = makePrisma({ organizer: { findUnique: jest.fn().mockResolvedValue(organizer({ status: OrganizerStatus.CLAIMED, users: [{ id: 99 }] })) } });
    const email = emailMock();
    const service = new OrganizerClaimService(prisma as never, email as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.requestClaim({ organizerSlug: "test-organizer", email: "organizer@example.hr" });

    expect(email.sendOrganizerClaim).not.toHaveBeenCalled();
    const createArgs = prisma.organizerClaim.create.mock.calls[0][0];
    expect(createArgs.data.status).toBe("NEEDS_ADMIN_REVIEW");
  });

  it("invalidates previous unresolved claims for the organizer before creating a new automatic one", async () => {
    const prisma = makePrisma();
    const service = new OrganizerClaimService(prisma as never, emailMock() as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.requestClaim({ organizerSlug: "test-organizer", email: "organizer@example.hr" });

    expect(prisma.organizerClaim.updateMany).toHaveBeenCalledWith({
      where: { organizerId: 7, status: { in: ["PENDING", "EMAIL_VERIFICATION_SENT", "NEEDS_ADMIN_REVIEW"] } },
      data: { status: "EXPIRED", tokenHash: null },
    });
  });

  it("deletes the newly created claim token when the email fails to send, still returning the generic message", async () => {
    const prisma = makePrisma();
    const email = emailMock({ sendOrganizerClaim: jest.fn().mockRejectedValue(new Error("Resend down")) });
    const service = new OrganizerClaimService(prisma as never, email as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    const result = await service.requestClaim({ organizerSlug: "test-organizer", email: "organizer@example.hr" });

    expect(result).toEqual({ message: GENERIC_MESSAGE });
    expect(prisma.organizerClaim.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});

describe("OrganizerClaimService.requestClaimByEmail", () => {
  it("returns the identical generic message whether or not the email matches anything", async () => {
    const prisma = makePrisma({ organizer: { findFirst: jest.fn().mockResolvedValue(null) } });
    const service = new OrganizerClaimService(prisma as never, emailMock() as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    const result = await service.requestClaimByEmail({ email: "nobody@example.hr" });

    expect(result).toEqual({ message: GENERIC_MESSAGE });
  });

  it("does nothing when no organizer matches the email", async () => {
    const prisma = makePrisma({ organizer: { findFirst: jest.fn().mockResolvedValue(null) } });
    const email = emailMock();
    const service = new OrganizerClaimService(prisma as never, email as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.requestClaimByEmail({ email: "nobody@example.hr" });

    expect(prisma.organizerClaim.create).not.toHaveBeenCalled();
    expect(email.sendOrganizerClaim).not.toHaveBeenCalled();
    expect(email.sendAdminNewSubmission).not.toHaveBeenCalled();
  });

  it("finds the matching UNCLAIMED organizer by email alone (no slug needed) and sends the automatic claim link", async () => {
    const prisma = makePrisma();
    const email = emailMock();
    const service = new OrganizerClaimService(prisma as never, email as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    const result = await service.requestClaimByEmail({ email: "organizer@example.hr" });

    expect(result).toEqual({ message: GENERIC_MESSAGE });
    expect(prisma.organizer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: { equals: "organizer@example.hr", mode: "insensitive" } } })
    );
    expect(email.sendOrganizerClaim).toHaveBeenCalledTimes(1);
    const createArgs = prisma.organizerClaim.create.mock.calls[0][0];
    expect(createArgs.data.status).toBe("EMAIL_VERIFICATION_SENT");
  });

  it("flags for admin review when the matched organizer is already claimed", async () => {
    const prisma = makePrisma({ organizer: { findFirst: jest.fn().mockResolvedValue(organizer({ status: OrganizerStatus.CLAIMED, users: [{ id: 99 }] })) } });
    const email = emailMock();
    const service = new OrganizerClaimService(prisma as never, email as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.requestClaimByEmail({ email: "organizer@example.hr" });

    expect(email.sendOrganizerClaim).not.toHaveBeenCalled();
    expect(email.sendAdminNewSubmission).toHaveBeenCalledTimes(1);
    const createArgs = prisma.organizerClaim.create.mock.calls[0][0];
    expect(createArgs.data.status).toBe("NEEDS_ADMIN_REVIEW");
  });

  it("still takes the automatic path for a VERIFIED/TRUSTED organizer that has never actually registered", async () => {
    // Regression test: OrganizerStatus VERIFIED/TRUSTED is a trust badge an
    // admin can set independently of whether anyone has ever claimed the
    // profile — it must never be treated as "already claimed" by itself.
    const prisma = makePrisma({ organizer: { findFirst: jest.fn().mockResolvedValue(organizer({ status: OrganizerStatus.TRUSTED, users: [] })) } });
    const email = emailMock();
    const service = new OrganizerClaimService(prisma as never, email as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.requestClaimByEmail({ email: "organizer@example.hr" });

    expect(email.sendOrganizerClaim).toHaveBeenCalledTimes(1);
    expect(email.sendAdminNewSubmission).not.toHaveBeenCalled();
  });

  it("never syncs a Resend contact for a pending request", async () => {
    const prisma = makePrisma();
    const contacts = contactsMock();
    const service = new OrganizerClaimService(prisma as never, emailMock() as never, contacts as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.requestClaimByEmail({ email: "organizer@example.hr" });

    expect(contacts.syncClaimedOrganizer).not.toHaveBeenCalled();
  });
});

describe("OrganizerClaimService.completeClaim", () => {
  const RAW_TOKEN = "a".repeat(64);
  const TOKEN_HASH = createHash("sha256").update(RAW_TOKEN).digest("hex");

  function activeClaim(overrides: Record<string, unknown> = {}) {
    return {
      id: 3,
      organizerId: 7,
      email: "organizer@example.hr",
      tokenHash: TOKEN_HASH,
      status: "EMAIL_VERIFICATION_SENT",
      expiresAt: new Date(Date.now() + 60_000),
      ...overrides,
    };
  }

  function makeTx() {
    return {
      user: { update: jest.fn().mockResolvedValue({ id: 2, email: "organizer@example.hr", organizerId: 7 }), create: jest.fn().mockResolvedValue({ id: 2, email: "organizer@example.hr", organizerId: 7 }) },
      organizer: { update: jest.fn().mockResolvedValue({}) },
      organizerClaim: { update: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
  }

  function makePrismaForComplete(overrides: Record<string, unknown> = {}) {
    const tx = makeTx();
    return {
      tx,
      prisma: {
        organizerClaim: { findUnique: jest.fn().mockResolvedValue(activeClaim()) },
        organizer: { findUnique: jest.fn().mockResolvedValue(organizer()) },
        user: { findUnique: jest.fn().mockResolvedValue(null) },
        $transaction: jest.fn((cb) => cb(tx)),
        ...overrides,
      },
    };
  }

  it("rejects an unknown token", async () => {
    const { prisma } = makePrismaForComplete({ organizerClaim: { findUnique: jest.fn().mockResolvedValue(null) } });
    const service = new OrganizerClaimService(prisma as never, emailMock() as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await expect(service.completeClaim({ token: RAW_TOKEN, name: "New Organizer", password: "brandNewPassword123" }))
      .rejects.toThrow(INVALID_CLAIM_MESSAGE);
  });

  it("rejects an expired token", async () => {
    const { prisma } = makePrismaForComplete({
      organizerClaim: { findUnique: jest.fn().mockResolvedValue(activeClaim({ expiresAt: new Date(Date.now() - 1000) })) },
    });
    const service = new OrganizerClaimService(prisma as never, emailMock() as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await expect(service.completeClaim({ token: RAW_TOKEN, name: "New Organizer", password: "brandNewPassword123" }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects an already-completed (used) token", async () => {
    const { prisma } = makePrismaForComplete({
      organizerClaim: { findUnique: jest.fn().mockResolvedValue(activeClaim({ status: "COMPLETED" })) },
    });
    const service = new OrganizerClaimService(prisma as never, emailMock() as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await expect(service.completeClaim({ token: RAW_TOKEN, name: "New Organizer", password: "brandNewPassword123" }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects when the organizer is already claimed (race with another completion)", async () => {
    const { prisma } = makePrismaForComplete({ organizer: { findUnique: jest.fn().mockResolvedValue(organizer({ status: OrganizerStatus.CLAIMED, users: [{ id: 99 }] })) } });
    const service = new OrganizerClaimService(prisma as never, emailMock() as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await expect(service.completeClaim({ token: RAW_TOKEN, name: "New Organizer", password: "brandNewPassword123" }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates a new User safely when none exists yet, hashing the password", async () => {
    const { prisma, tx } = makePrismaForComplete();
    const service = new OrganizerClaimService(prisma as never, emailMock() as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    const result = await service.completeClaim({ token: RAW_TOKEN, name: "New Organizer", password: "brandNewPassword123" });

    expect(result).toEqual({ message: "Profil je uspješno preuzet." });
    expect(tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: "organizer@example.hr", name: "New Organizer", role: UserRole.ORGANIZER, organizerId: 7 }),
    });
    const passwordHash = tx.user.create.mock.calls[0][0].data.passwordHash;
    expect(passwordHash).not.toBe("brandNewPassword123");
    expect(await bcrypt.compare("brandNewPassword123", passwordHash)).toBe(true);
    expect(tx.organizer.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { status: OrganizerStatus.CLAIMED } });
  });

  it("requires name and password when no User exists yet", async () => {
    const { prisma } = makePrismaForComplete();
    const service = new OrganizerClaimService(prisma as never, emailMock() as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await expect(service.completeClaim({ token: RAW_TOKEN })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("links an existing User without requiring a new password", async () => {
    const { prisma, tx } = makePrismaForComplete({
      user: { findUnique: jest.fn().mockResolvedValue({ id: 2, email: "organizer@example.hr", role: UserRole.ORGANIZER, organizerId: null }) },
    });
    const service = new OrganizerClaimService(prisma as never, emailMock() as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    const result = await service.completeClaim({ token: RAW_TOKEN });

    expect(result).toEqual({ message: "Profil je uspješno preuzet." });
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 2 }, data: { organizerId: 7, role: UserRole.ORGANIZER } });
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it("rejects when the existing User is already attached to a different Organizer", async () => {
    const { prisma } = makePrismaForComplete({
      user: { findUnique: jest.fn().mockResolvedValue({ id: 2, email: "organizer@example.hr", role: UserRole.ORGANIZER, organizerId: 99 }) },
    });
    const service = new OrganizerClaimService(prisma as never, emailMock() as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await expect(service.completeClaim({ token: RAW_TOKEN })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects when the matched account is an admin account", async () => {
    const { prisma } = makePrismaForComplete({
      user: { findUnique: jest.fn().mockResolvedValue({ id: 2, email: "organizer@example.hr", role: UserRole.ADMIN, organizerId: null }) },
    });
    const service = new OrganizerClaimService(prisma as never, emailMock() as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await expect(service.completeClaim({ token: RAW_TOKEN })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("invalidates other unresolved claims for the organizer on completion", async () => {
    const { prisma, tx } = makePrismaForComplete();
    const service = new OrganizerClaimService(prisma as never, emailMock() as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.completeClaim({ token: RAW_TOKEN, name: "New Organizer", password: "brandNewPassword123" });

    expect(tx.organizerClaim.updateMany).toHaveBeenCalledWith({
      where: { organizerId: 7, id: { not: 3 }, status: { in: ["PENDING", "EMAIL_VERIFICATION_SENT", "NEEDS_ADMIN_REVIEW"] } },
      data: { status: "EXPIRED", tokenHash: null },
    });
  });

  it("syncs a Resend contact after completion, and a sync failure does not roll back or fail the claim", async () => {
    const { prisma } = makePrismaForComplete();
    const contacts = contactsMock({ syncClaimedOrganizer: jest.fn().mockRejectedValue(new Error("Resend down")) });
    const service = new OrganizerClaimService(prisma as never, emailMock() as never, contacts as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    const result = await service.completeClaim({ token: RAW_TOKEN, name: "New Organizer", password: "brandNewPassword123" });

    expect(result).toEqual({ message: "Profil je uspješno preuzet." });
    expect(contacts.syncClaimedOrganizer).toHaveBeenCalledTimes(1);
  });
});

describe("OrganizerClaimService.verifyToken", () => {
  const RAW_TOKEN = "b".repeat(64);
  const TOKEN_HASH = createHash("sha256").update(RAW_TOKEN).digest("hex");

  it("reports requiresPassword=true when no User exists yet for the claim email", async () => {
    const prisma = {
      organizerClaim: {
        findUnique: jest.fn().mockResolvedValue({ id: 3, organizerId: 7, email: "organizer@example.hr", tokenHash: TOKEN_HASH, status: "EMAIL_VERIFICATION_SENT", expiresAt: new Date(Date.now() + 60_000) }),
      },
      organizer: { findUnique: jest.fn().mockResolvedValue(organizer()) },
      user: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new OrganizerClaimService(prisma as never, emailMock() as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    const result = await service.verifyToken({ token: RAW_TOKEN });

    expect(result).toEqual({ valid: true, requiresPassword: true, organizerName: "Test Organizer" });
  });

  it("reports valid=false for an unknown token", async () => {
    const prisma = { organizerClaim: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new OrganizerClaimService(prisma as never, emailMock() as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    const result = await service.verifyToken({ token: RAW_TOKEN });

    expect(result).toEqual({ valid: false });
  });
});

describe("OrganizerClaimService.listClaims", () => {
  it("includes organizer details for the admin review table", async () => {
    const prisma = { organizerClaim: { findMany: jest.fn().mockResolvedValue([{ id: 1 }]) } };
    const service = new OrganizerClaimService(prisma as never, emailMock() as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    const result = await service.listClaims();

    expect(result).toEqual([{ id: 1 }]);
    expect(prisma.organizerClaim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: expect.objectContaining({ organizer: expect.anything() }) })
    );
  });
});

describe("OrganizerClaimService.approveClaim", () => {
  function reviewClaim(overrides: Record<string, unknown> = {}) {
    return { id: 5, organizerId: 7, email: "someone@example.hr", status: "NEEDS_ADMIN_REVIEW", ...overrides };
  }

  it("sends a claim email and moves the claim to EMAIL_VERIFICATION_SENT", async () => {
    const prisma = makePrisma({ organizerClaim: { ...makePrisma().organizerClaim, findUnique: jest.fn().mockResolvedValue(reviewClaim()) } });
    const email = emailMock();
    const service = new OrganizerClaimService(prisma as never, email as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    const result = await service.approveClaim(5);

    expect(result).toEqual({ message: "Poziv za preuzimanje profila poslan." });
    expect(email.sendOrganizerClaim).toHaveBeenCalledWith("someone@example.hr", expect.objectContaining({ organizerName: "Test Organizer" }));
    expect(prisma.organizerClaim.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 5 }, data: expect.objectContaining({ status: "EMAIL_VERIFICATION_SENT" }) })
    );
  });

  it("rejects approving a claim that isn't pending review", async () => {
    const prisma = makePrisma({ organizerClaim: { ...makePrisma().organizerClaim, findUnique: jest.fn().mockResolvedValue(reviewClaim({ status: "COMPLETED" })) } });
    const service = new OrganizerClaimService(prisma as never, emailMock() as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await expect(service.approveClaim(5)).rejects.toThrow(/nije na čekanju/);
  });

  it("rejects approving when the organizer is already claimed", async () => {
    const prisma = makePrisma({
      organizer: { findUnique: jest.fn().mockResolvedValue(organizer({ status: OrganizerStatus.CLAIMED, users: [{ id: 99 }] })) },
      organizerClaim: { ...makePrisma().organizerClaim, findUnique: jest.fn().mockResolvedValue(reviewClaim()) },
    });
    const service = new OrganizerClaimService(prisma as never, emailMock() as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await expect(service.approveClaim(5)).rejects.toThrow(/već preuzet/);
  });

  it("reverts to NEEDS_ADMIN_REVIEW and surfaces an error when the claim email fails to send", async () => {
    const prisma = makePrisma({ organizerClaim: { ...makePrisma().organizerClaim, findUnique: jest.fn().mockResolvedValue(reviewClaim()) } });
    const email = emailMock({ sendOrganizerClaim: jest.fn().mockRejectedValue(new Error("Resend down")) });
    const service = new OrganizerClaimService(prisma as never, email as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await expect(service.approveClaim(5)).rejects.toBeInstanceOf(BadRequestException);

    const revertCall = prisma.organizerClaim.update.mock.calls.find(
      ([args]: [{ data?: { status?: string } }]) => args.data?.status === "NEEDS_ADMIN_REVIEW"
    );
    expect(revertCall).toBeTruthy();
  });
});

describe("OrganizerClaimService.rejectClaim", () => {
  it("marks the claim REJECTED with an optional internal reason", async () => {
    const prisma = makePrisma({ organizerClaim: { ...makePrisma().organizerClaim, findUnique: jest.fn().mockResolvedValue({ id: 5 }) } });
    const service = new OrganizerClaimService(prisma as never, emailMock() as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    const result = await service.rejectClaim(5, "Sumnjiv zahtjev");

    expect(result).toEqual({ message: "Zahtjev odbijen." });
    expect(prisma.organizerClaim.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: expect.objectContaining({ status: "REJECTED", internalReason: "Sumnjiv zahtjev" }),
    });
  });

  it("does not add a Resend Contact for a rejected claim", async () => {
    const prisma = makePrisma({ organizerClaim: { ...makePrisma().organizerClaim, findUnique: jest.fn().mockResolvedValue({ id: 5 }) } });
    const contacts = contactsMock();
    const service = new OrganizerClaimService(prisma as never, emailMock() as never, contacts as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.rejectClaim(5);

    expect(contacts.syncClaimedOrganizer).not.toHaveBeenCalled();
  });
});

describe("OrganizerClaimService.sendClaimInvite", () => {
  it("sends a claim invite for an eligible UNCLAIMED organizer with an email", async () => {
    const prisma = makePrisma();
    const email = emailMock();
    const service = new OrganizerClaimService(prisma as never, email as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    const result = await service.sendClaimInvite(7);

    expect(result).toEqual({ message: "Poziv za preuzimanje profila poslan." });
    expect(email.sendOrganizerClaim).toHaveBeenCalledWith("organizer@example.hr", expect.anything());
  });

  it("rejects inviting an already-claimed organizer", async () => {
    const prisma = makePrisma({ organizer: { findUnique: jest.fn().mockResolvedValue(organizer({ status: OrganizerStatus.CLAIMED, users: [{ id: 99 }] })) } });
    const service = new OrganizerClaimService(prisma as never, emailMock() as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await expect(service.sendClaimInvite(7)).rejects.toThrow(/već preuzet/);
  });

  it("rejects inviting an organizer with no email on file", async () => {
    const prisma = makePrisma({ organizer: { findUnique: jest.fn().mockResolvedValue(organizer({ email: null })) } });
    const service = new OrganizerClaimService(prisma as never, emailMock() as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await expect(service.sendClaimInvite(7)).rejects.toThrow(/nema email/);
  });
});

function makeBulkPrisma(organizers: Array<Record<string, unknown>>) {
  const byId = new Map(organizers.map((o) => [o.id, o]));
  return {
    organizer: {
      findMany: jest.fn().mockResolvedValue(organizers),
      findUnique: jest.fn(({ where }: { where: { id: number } }) => Promise.resolve(byId.get(where.id) ?? null)),
    },
    organizerClaim: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({ id: 100 }),
      delete: jest.fn().mockResolvedValue({ id: 100 }),
    },
  };
}

describe("OrganizerClaimService.bulkInviteUnclaimedOrganizers", () => {
  it("invites an eligible UNCLAIMED organizer with an email and no active invite", async () => {
    const prisma = makeBulkPrisma([
      { id: 1, name: "Org A", email: "orga@example.hr", status: OrganizerStatus.UNCLAIMED, users: [], claims: [] },
    ]);
    const email = emailMock();
    const service = new OrganizerClaimService(prisma as never, email as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    const stats = await service.bulkInviteUnclaimedOrganizers();

    expect(stats).toMatchObject({ scanned: 1, eligible: 1, invited: 1 });
    expect(email.sendOrganizerClaim).toHaveBeenCalledWith("orga@example.hr", expect.anything());
  });

  it("skips an organizer that already has an active unexpired invite", async () => {
    const prisma = makeBulkPrisma([
      {
        id: 1, name: "Org A", email: "orga@example.hr", status: OrganizerStatus.UNCLAIMED, users: [],
        claims: [{ id: 9, expiresAt: new Date(Date.now() + 60_000) }],
      },
    ]);
    const email = emailMock();
    const service = new OrganizerClaimService(prisma as never, email as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    const stats = await service.bulkInviteUnclaimedOrganizers();

    expect(stats).toMatchObject({ activeInviteSkipped: 1, invited: 0 });
    expect(email.sendOrganizerClaim).not.toHaveBeenCalled();
  });

  it("counts a missing or invalid email separately from unengaged/claimed organizers", async () => {
    const prisma = makeBulkPrisma([
      { id: 1, name: "Org A", email: null, status: OrganizerStatus.UNCLAIMED, users: [], claims: [] },
    ]);
    const service = new OrganizerClaimService(prisma as never, emailMock() as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    const stats = await service.bulkInviteUnclaimedOrganizers();

    expect(stats).toMatchObject({ missingEmail: 1, eligible: 0, invited: 0 });
  });

  it("skips an organizer already attached to a User despite UNCLAIMED status", async () => {
    const prisma = makeBulkPrisma([
      { id: 1, name: "Org A", email: "orga@example.hr", status: OrganizerStatus.UNCLAIMED, users: [{ id: 5 }], claims: [] },
    ]);
    const service = new OrganizerClaimService(prisma as never, emailMock() as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    const stats = await service.bulkInviteUnclaimedOrganizers();

    expect(stats).toMatchObject({ alreadyClaimed: 1, invited: 0 });
  });

  it("dry-run counts eligible organizers without sending any email or writing claims", async () => {
    const prisma = makeBulkPrisma([
      { id: 1, name: "Org A", email: "orga@example.hr", status: OrganizerStatus.UNCLAIMED, users: [], claims: [] },
    ]);
    const email = emailMock();
    const service = new OrganizerClaimService(prisma as never, email as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    const stats = await service.bulkInviteUnclaimedOrganizers({ dryRun: true });

    expect(stats).toMatchObject({ eligible: 1, invited: 0 });
    expect(email.sendOrganizerClaim).not.toHaveBeenCalled();
    expect(prisma.organizerClaim.create).not.toHaveBeenCalled();
  });

  it("respects --limit, still counting all eligible organizers but only sending up to the cap", async () => {
    const prisma = makeBulkPrisma([
      { id: 1, name: "Org A", email: "orga@example.hr", status: OrganizerStatus.UNCLAIMED, users: [], claims: [] },
      { id: 2, name: "Org B", email: "orgb@example.hr", status: OrganizerStatus.UNCLAIMED, users: [], claims: [] },
    ]);
    const email = emailMock();
    const service = new OrganizerClaimService(prisma as never, email as never, contactsMock() as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    const stats = await service.bulkInviteUnclaimedOrganizers({ limit: 1 });

    expect(stats).toMatchObject({ eligible: 2, invited: 1 });
    expect(email.sendOrganizerClaim).toHaveBeenCalledTimes(1);
  });

  it("never syncs a Resend contact for a bulk invite — only a completed claim does that", async () => {
    const prisma = makeBulkPrisma([
      { id: 1, name: "Org A", email: "orga@example.hr", status: OrganizerStatus.UNCLAIMED, users: [], claims: [] },
    ]);
    const contacts = contactsMock();
    const service = new OrganizerClaimService(prisma as never, emailMock() as never, contacts as never, { revalidate: jest.fn().mockResolvedValue(true) } as never);

    await service.bulkInviteUnclaimedOrganizers();

    expect(contacts.syncClaimedOrganizer).not.toHaveBeenCalled();
  });
});
