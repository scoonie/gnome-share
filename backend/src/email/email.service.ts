import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import type { User } from "../generated/prisma/client";
import relativeTime from "dayjs/plugin/relativeTime";
import dayjs from "dayjs";
import * as nodemailer from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import { ConfigService } from "src/config/config.service";

dayjs.extend(relativeTime);

@Injectable()
export class EmailService {
  private transporter?: nodemailer.Transporter<SMTPTransport.SentMessageInfo>;

  constructor(private config: ConfigService) {
    this.config.addListener("update", (key: string) => {
      if (key.startsWith("smtp.")) {
        this.transporter?.close();
        this.transporter = undefined;
      }
    });
  }
  private readonly logger = new Logger(EmailService.name);

  getTransporter() {
    if (!this.config.get("smtp.enabled"))
      throw new InternalServerErrorException("SMTP is disabled");

    const username = this.config.get("smtp.username");
    const password = this.config.get("smtp.password");

    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.config.get("smtp.host"),
        port: this.config.get("smtp.port"),
        secure: this.config.get("smtp.port") === 465,
        auth:
          username || password ? { user: username, pass: password } : undefined,
        tls: {
          rejectUnauthorized: !this.config.get(
            "smtp.allowUnauthorizedCertificates",
          ),
        },
      });
    }
    return this.transporter;
  }

  private async sendMail(email: string, subject: string, text: string) {
    await this.getTransporter()
      .sendMail({
        from: `"${this.config.get("general.appName")}" <${this.config.get(
          "smtp.email",
        )}>`,
        to: email,
        subject,
        text,
      })
      .catch((e) => {
        this.logger.error(e);
        throw new InternalServerErrorException("Failed to send email");
      });
  }

  async sendMailToShareRecipients(
    recipientEmail: string,
    shareId: string,
    creator?: User,
    description?: string,
    expiration?: Date,
  ) {
    if (!this.config.get("email.enableShareEmailRecipients"))
      throw new InternalServerErrorException("Email service disabled");

    const shareUrl = `${this.config.get("general.appUrl")}/s/${shareId}`;

    await this.sendMail(
      recipientEmail,
      this.config.get("email.shareRecipientsSubject"),
      this.config
        .get("email.shareRecipientsMessage")
        .replaceAll("\\n", "\n")
        .replaceAll("{creator}", creator?.username ?? "Someone")
        .replaceAll("{creatorEmail}", creator?.email ?? "")
        .replaceAll("{shareUrl}", shareUrl)
        .replaceAll("{desc}", description ?? "No description")
        .replaceAll(
          "{expires}",
          expiration ? dayjs(expiration).fromNow() : "unknown",
        ),
    );
  }

  async sendMailToReverseShareCreator(recipientEmail: string, shareId: string) {
    const shareUrl = `${this.config.get("general.appUrl")}/s/${shareId}`;

    await this.sendMail(
      recipientEmail,
      this.config.get("email.reverseShareSubject"),
      this.config
        .get("email.reverseShareMessage")
        .replaceAll("\\n", "\n")
        .replaceAll("{shareUrl}", shareUrl),
    );
  }

  async sendResetPasswordEmail(recipientEmail: string, token: string) {
    const resetPasswordUrl = `${this.config.get(
      "general.appUrl",
    )}/auth/resetPassword/${token}`;

    await this.sendMail(
      recipientEmail,
      this.config.get("email.resetPasswordSubject"),
      this.config
        .get("email.resetPasswordMessage")
        .replaceAll("\\n", "\n")
        .replaceAll("{url}", resetPasswordUrl),
    );
  }

  async sendInviteEmail(recipientEmail: string, password: string) {
    const loginUrl = `${this.config.get("general.appUrl")}/auth/signIn`;

    await this.sendMail(
      recipientEmail,
      this.config.get("email.inviteSubject"),
      this.config
        .get("email.inviteMessage")
        .replaceAll("{url}", loginUrl)
        .replaceAll("{password}", password)
        .replaceAll("{email}", recipientEmail),
    );
  }

  async sendTestMail(recipientEmail: string) {
    await this.getTransporter()
      .sendMail({
        from: `"${this.config.get("general.appName")}" <${this.config.get(
          "smtp.email",
        )}>`,
        to: recipientEmail,
        subject: "Test email",
        text: "This is a test email",
      })
      .catch((e) => {
        this.logger.error(e);
        // Surfacing the SMTP error to the caller is acceptable here: this is
        // an admin-only endpoint and the admin already has SMTP credentials
        // via the config UI, so the raw error message reveals nothing new.
        throw new InternalServerErrorException(e.message);
      });
  }
}
