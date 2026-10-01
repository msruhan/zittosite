import {
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseInterceptors,
} from "@nestjs/common";
import { NoFilesInterceptor } from "@nestjs/platform-express";
import { SkipThrottle } from "@nestjs/throttler";
import type { Request } from "express";
import { DhruService } from "./dhru.service";
import { dhruError } from "./dhru-format";

/**
 * Dhru Fusion compatible endpoint. Dhru clients post form fields
 * (urlencoded, or multipart from PHP curl) and expect HTTP 200 for errors too.
 * Rate limits are per API key inside DhruService, not the global IP throttler.
 */
@Controller("api")
@SkipThrottle()
export class DhruController {
  constructor(private readonly dhru: DhruService) {}

  @Post(["index.php", "dhru", "dhru/index.php"])
  @HttpCode(200)
  @UseInterceptors(NoFilesInterceptor())
  handle(@Req() req: Request) {
    const form =
      req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    return this.dhru.handle(form, req.ip);
  }

  @Get(["index.php", "dhru", "dhru/index.php"])
  info() {
    return dhruError("Invalid request", "use_post");
  }
}
