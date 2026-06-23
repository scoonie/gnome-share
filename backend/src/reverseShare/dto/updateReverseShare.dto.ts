import { IsArray, IsEmail, IsOptional } from "class-validator";

export class UpdateReverseShareDTO {
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  viewerEmails?: string[];
}
