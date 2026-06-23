import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Request } from "express";
import dayjs from "dayjs";
import { PrismaService } from "src/prisma/prisma.service";
import { ShareService } from "src/share/share.service";
import { ConfigService } from "src/config/config.service";
import { JwtGuard } from "src/auth/guard/jwt.guard";
import type { User } from "../../generated/prisma/client";

/**
 * Determines whether a user may access a share that belongs to a private
 * (non-public) reverse share. Access is granted to the share creator, the
 * reverse share creator, and any user whose email is listed as a reverse
 * share viewer (matched case-insensitively and trimmed). Evaluated live on
 * every request, so removing a viewer immediately revokes their access.
 */
export function canAccessPrivateReverseShare(
  share: {
    creatorId: string | null;
    reverseShare: {
      creatorId: string;
      publicAccess: boolean;
      viewers?: { email: string }[];
    };
  },
  user?: { id?: string; email?: string },
): boolean {
  if (share.reverseShare.publicAccess) return true;

  if (
    user?.id &&
    (share.creatorId === user.id || share.reverseShare.creatorId === user.id)
  )
    return true;

  const userEmail = user?.email?.trim().toLowerCase();
  if (userEmail) {
    const viewers = share.reverseShare.viewers ?? [];
    if (viewers.some((viewer) => viewer.email.trim().toLowerCase() === userEmail))
      return true;
  }

  return false;
}

@Injectable()
export class ShareSecurityGuard extends JwtGuard {
  constructor(
    private shareService: ShareService,
    private prisma: PrismaService,
    configService: ConfigService,
  ) {
    super(configService);
  }

  async canActivate(context: ExecutionContext) {
    const request: Request = context.switchToHttp().getRequest();

    const shareId = Object.prototype.hasOwnProperty.call(
      request.params,
      "shareId",
    )
      ? request.params.shareId
      : request.params.id;

    const shareToken = request.cookies[`share_${shareId}_token`];

    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
      include: {
        security: true,
        reverseShare: { include: { viewers: true } },
      },
    });

    if (
      !share ||
      (dayjs().isAfter(share.expiration) &&
        dayjs(share.expiration).valueOf() !== 0)
    )
      throw new NotFoundException("Share not found");

    if (share.security?.password && !shareToken)
      throw new ForbiddenException(
        "This share is password protected",
        "share_password_required",
      );

    if (!(await this.shareService.verifyShareToken(shareId, shareToken)))
      throw new ForbiddenException(
        "Share token required",
        "share_token_required",
      );

    // Run the JWTGuard to set the user
    await super.canActivate(context);
    const user = request.user as User;

    // Only the creator, reverse share creator, and listed viewers can access
    // the reverse share if it's not public
    if (
      share.reverseShare &&
      !canAccessPrivateReverseShare(share, user)
    )
      throw new ForbiddenException(
        "Only reverse share creator can access this share",
        "private_share",
      );

    return true;
  }
}
