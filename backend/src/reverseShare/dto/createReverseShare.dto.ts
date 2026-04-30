import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateReverseShareDTO {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string;

  @IsBoolean()
  sendEmailNotification: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxShareSize: number;

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
