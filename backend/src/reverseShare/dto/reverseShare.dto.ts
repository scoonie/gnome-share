import { Expose, plainToClass } from "class-transformer";

export class ReverseShareDTO {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  description?: string | null;

  @Expose()
  maxShareSize: number;

  @Expose()
  shareExpiration: Date;

  @Expose()
  token: string;

  @Expose()
  simplified: boolean;

  from(partial: Partial<ReverseShareDTO>) {
    return plainToClass(ReverseShareDTO, partial, {
      excludeExtraneousValues: true,
    });
  }
}
