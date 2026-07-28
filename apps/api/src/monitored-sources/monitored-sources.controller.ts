import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { Roles } from "../auth/auth.decorators";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { MonitoredSourcesService } from "./monitored-sources.service";
import { CreateMonitoredSourceDto, UpdateMonitoredSourceDto } from "./monitored-sources.dto";

@Controller("admin/monitored-sources")
@UseGuards(JwtAuthGuard)
@Roles(UserRole.ADMIN)
export class MonitoredSourcesController {
  constructor(private readonly sources: MonitoredSourcesService) {}

  @Get() list() { return this.sources.list(); }
  @Get(":id") get(@Param("id") id: string) { return this.sources.get(Number(id)); }
  @Get(":id/runs") runs(@Param("id") id: string) { return this.sources.runs(Number(id)); }
  @Post() create(@Body() dto: CreateMonitoredSourceDto) { return this.sources.create(dto); }
  @Put(":id") update(@Param("id") id: string, @Body() dto: UpdateMonitoredSourceDto) { return this.sources.update(Number(id), dto); }
  @Delete(":id") delete(@Param("id") id: string) { return this.sources.delete(Number(id)); }
  @Post(":id/run") runNow(@Param("id") id: string) { return this.sources.runNow(Number(id)); }
}
