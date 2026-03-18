import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { User } from "../../generated/prisma/client";

@Injectable()
export class AdministratorGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const { user }: { user: User } = context.switchToHttp().getRequest();

    if (!user) return false;

    return user.isAdmin;
  }
}
