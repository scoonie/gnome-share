import { IsBoolean, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateReverseShareDTO {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsBoolean()
  sendEmailNotification: boolean;

  @IsString()
  maxShareSize: string;

  @IsString()
  shareExpiration: string;

  @Min(1)
  @Max(1000)
  maxUseCount: number;

  @IsBoolean()
  simplified: boolean;

  @IsBoolean()
  publicAccess: boolean;
}
