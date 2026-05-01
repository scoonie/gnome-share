import { Expose, plainToClass } from "class-transformer";

export class ShareMetaDataDTO {
  @Expose()
  id: string;

  @Expose()
  isZipReady: boolean;

  @Expose()
  zipCreationFailed: boolean;

  from(partial: Partial<ShareMetaDataDTO>) {
    return plainToClass(ShareMetaDataDTO, partial, {
      excludeExtraneousValues: true,
    });
  }
}
