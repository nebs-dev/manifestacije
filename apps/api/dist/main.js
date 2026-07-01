"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
function corsOrigin(origin, callback) {
    if (!origin)
        return callback(null, true);
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
    if (allowedOrigins.has(origin) || isVercelPreview)
        return callback(null, true);
    return callback(new Error(`CORS origin not allowed: ${origin}`), false);
}
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.use(require("express").json({ limit: "10mb" }));
    app.setGlobalPrefix("api");
    app.enableCors({ origin: corsOrigin, credentials: true });
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(process.env.PORT ? Number(process.env.PORT) : 3001);
}
void bootstrap();
