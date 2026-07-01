import "dotenv/config";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

function corsOrigin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
  if (!origin) return callback(null, true);
  const allowedOrigins = new Set([
    "http://localhost:3000",
    "https://manifestacije.hr",
    "https://www.manifestacije.hr",
    ...(process.env.CORS_ALLOWED_ORIGINS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ]);
  const isVercelPreview = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
  if (allowedOrigins.has(origin) || isVercelPreview) return callback(null, true);
  return callback(new Error(`CORS origin not allowed: ${origin}`), false);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(require("express").json({ limit: "10mb" }));
  app.setGlobalPrefix("api");
  app.enableCors({ origin: corsOrigin, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3001);
}

void bootstrap();
