import { BadRequestException, Injectable } from "@nestjs/common";
import * as fs from "fs/promises";
import * as path from "path";
import sharp from "sharp";

// Resolve the on-disk location of the frontend's static image folder.
// In Docker (the supported deployment) the backend runs from
// `/opt/app/backend`, so the default of `../frontend/public/img` resolves to
// `/opt/app/frontend/public/img`. The IMAGES_PATH env var lets operators
// override it for non-standard layouts (mounted volumes, dev setups, etc.).
const IMAGES_PATH =
  process.env.IMAGES_PATH ??
  path.resolve(process.cwd(), "../frontend/public/img");

@Injectable()
export class LogoService {
  async create(file: Buffer) {
    // Validate that the file is actually a supported image
    try {
      const metadata = await sharp(file).metadata();
      if (!metadata.format || !["png", "jpeg", "webp"].includes(metadata.format)) {
        throw new BadRequestException(
          "Invalid image format. Supported formats: png, jpeg, webp",
        );
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException("File is not a valid image");
    }

    const resized = await sharp(file).resize(900).toBuffer();
    await fs.writeFile(path.join(IMAGES_PATH, "logo.png"), resized, "binary");
    await this.createFavicon(file);
    await this.createPWAIcons(file);
  }

  async createFavicon(file: Buffer) {
    const resized = await sharp(file).resize(16).toBuffer();
    await fs.writeFile(
      path.join(IMAGES_PATH, "favicon.ico"),
      resized,
      "binary",
    );
  }

  async createPWAIcons(file: Buffer) {
    const sizes = [48, 72, 96, 128, 144, 152, 192, 384, 512];

    await Promise.all(
      sizes.map(async (size) => {
        const resized = await sharp(file).resize(size).toBuffer();
        await fs.writeFile(
          path.join(IMAGES_PATH, "icons", `icon-${size}x${size}.png`),
          resized,
          "binary",
        );
      }),
    );
  }
}