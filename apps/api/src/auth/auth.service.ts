import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { slugify, uniqueSlug } from "../common/slug";
import { LoginDto, RegisterDto } from "./auth.dto";

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new BadRequestException("Email already registered");
    const organizerName = dto.organizerName || dto.name;
    const organizerSlug = await uniqueSlug(organizerName, async (s) => !!(await this.prisma.organizer.findUnique({ where: { slug: s } })));
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const organizer = await this.prisma.organizer.create({
      data: { name: organizerName, slug: organizerSlug, status: "CLAIMED", email: dto.email }
    });
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, name: dto.name, role: UserRole.ORGANIZER, organizerId: organizer.id }
    });
    return this.session(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) throw new UnauthorizedException("Invalid credentials");
    return this.session(user);
  }

  async me(userId: number) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, organizerId: true, organizer: true }
    });
  }

  private session(user: { id: number; email: string; name: string; role: UserRole; organizerId: number | null }) {
    const token = this.jwt.sign({ id: user.id, email: user.email, role: user.role, organizerId: user.organizerId });
    return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role, organizerId: user.organizerId } };
  }
}
