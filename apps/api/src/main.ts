import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { corsOrigins, validateStartupEnv } from "./config/env";

async function bootstrap() {
  validateStartupEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set("trust proxy", 1);
  app.use(cookieParser());
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === "production",
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.enableCors({
    origin: corsOrigins(),
    credentials: true,
  });
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 4000);
}
bootstrap();
