import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ReverseShareModule } from "src/reverseShare/reverseShare.module";
import { ShareModule } from "src/share/share.module";
import { FileController } from "./file.controller";
import { FileService } from "./file.service";
import { LocalFileService } from "./local.service";

@Module({
  imports: [JwtModule.register({}), ReverseShareModule, ShareModule],
  controllers: [FileController],
  providers: [FileService, LocalFileService],
  exports: [FileService],
})
export class FileModule {}
