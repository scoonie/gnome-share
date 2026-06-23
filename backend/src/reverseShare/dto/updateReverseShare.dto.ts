import { IsArray, IsDefined, IsEmail } from "class-validator";

export class UpdateReverseShareDTO {
  @IsDefined()
  @IsArray()
  @IsEmail({}, { each: true })
  viewerEmails: string[];
}
