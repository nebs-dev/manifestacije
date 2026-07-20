import { Module } from "@nestjs/common";
import { EmailService } from "./email.service";

// Not currently imported by AppModule — this codebase wires every service
// directly into AppModule's flat providers list (see app.module.ts) rather
// than composing feature modules. Kept for structure/testability and in case
// the app moves to composed modules later.
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
