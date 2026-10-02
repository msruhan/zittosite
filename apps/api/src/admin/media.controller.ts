import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "../security/audit-log.service";
import { AdminAuthGuard } from "./admin-auth.guard";
import { SuperAdminGuard } from "./super-admin.guard";
import { MEDIA_MAX_BYTES, detectImageMime } from "./media-files";

type AdminReq = { admin: { sub: string } };

@Controller("admin/media")
@UseGuards(AdminAuthGuard, SuperAdminGuard)
export class AdminMediaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MEDIA_MAX_BYTES, files: 1 } }))
  async upload(@Req() req: AdminReq, @UploadedFile() file?: Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException("Pilih file gambar.");
    const mimeType = detectImageMime(file.buffer);
    if (!mimeType) throw new BadRequestException("Gambar harus PNG, JPG, GIF, atau WebP.");
    const asset = await this.prisma.mediaAsset.create({
      data: {
        mimeType,
        data: new Uint8Array(file.buffer),
        size: file.size,
        createdBy: req.admin.sub,
      },
      select: { id: true },
    });
    this.audit.record("admin.media.uploaded", {
      actorId: req.admin.sub,
      mediaId: asset.id,
      size: file.size,
    });
    return { id: asset.id, path: `/media/${asset.id}` };
  }
}

/** Public: description images are shown to every visitor of an order page. */
@Controller("media")
export class MediaController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(":id")
  async show(@Param("id") id: string, @Res() res: Response) {
    if (!/^[a-z0-9]{10,40}$/i.test(id)) throw new NotFoundException();
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id },
      select: { mimeType: true, data: true },
    });
    if (!asset) throw new NotFoundException();
    res.set({
      "Content-Type": asset.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Security-Policy": "default-src 'none'",
      "X-Content-Type-Options": "nosniff",
    });
    res.send(Buffer.from(asset.data));
  }
}
