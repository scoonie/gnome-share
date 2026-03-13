import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Request } from "express";
import dayjs from "dayjs";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class ShareTokenSecurity implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request: Request = context.switchToHttp().getRequest();
    const shareId = Object.prototype.hasOwnProperty.call(
      request.params,
      "shareId",
    )
      ? request.params.shareId
      : request.params.id;

    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
      include: { security: true },
    });

    if (
      !share ||
      (dayjs().isAfter(share.expiration) &&
        dayjs(share.expiration).valueOf() !== 0)
    )
      throw new NotFoundException("Share not found");

    return true;
  }
}
