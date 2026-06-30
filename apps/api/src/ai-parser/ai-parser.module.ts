import { Module } from "@nestjs/common";
import { AiEventParserService } from "./ai-event-parser.service";
@Module({ providers: [AiEventParserService] })
export class AiParserModule {}
