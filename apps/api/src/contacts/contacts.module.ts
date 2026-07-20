import { Module } from "@nestjs/common";
import { ResendContactsService } from "./resend-contacts.service";
import { PrismaService } from "../prisma/prisma.service";

@Module({ providers: [ResendContactsService, PrismaService] })
export class ContactsModule {}
