import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly fromAddress: string;

  constructor(private config: ConfigService) {
    this.fromAddress = this.config.get<string>(
      'SMTP_FROM',
      'CaloFit <no-reply@calofit.com>',
    );

    const host = this.config.get<string>('SMTP_HOST');
    const port = this.config.get<number>('SMTP_PORT');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    if (host && port && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      this.logger.log('Nodemailer transporter initialized successfully.');
    } else {
      this.logger.warn(
        'SMTP environment variables are missing. MailService will run in developer fallback console-logging mode.',
      );
    }
  }

  async sendVerificationEmail(email: string, locale: string, token: string) {
    const frontendUrl = this.config
      .get<string>('CORS_ORIGINS', 'http://localhost:3001')
      .split(',')[0];
    const verificationUrl = `${frontendUrl}/${locale}/verify-email?token=${token}`;

    const subjectMap: Record<string, string> = {
      ru: 'Подтверждение регистрации на CaloFit',
      en: 'Confirm your registration on CaloFit',
      uz: 'CaloFit tizimida ro‘yxatdan o‘tishni tasdiqlash',
    };

    const subject = subjectMap[locale] || subjectMap.uz;

    const htmlContentMap: Record<string, string> = {
      ru: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #10b981; text-align: center;">Добро пожаловать в CaloFit! 🥗</h2>
          <p style="font-size: 16px; color: #333333; line-height: 1.6;">Спасибо за регистрацию. Пожалуйста, подтвердите свой email, нажав на кнопку ниже:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background-color: #10b981; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 24px; font-weight: bold; font-size: 16px; display: inline-block;">Подтвердить почту</a>
          </div>
          <p style="font-size: 12px; color: #666666;">Если кнопка не работает, скопируйте эту ссылку в браузер:</p>
          <p style="font-size: 12px; color: #10b981; word-break: break-all;">${verificationUrl}</p>
        </div>
      `,
      en: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #10b981; text-align: center;">Welcome to CaloFit! 🥗</h2>
          <p style="font-size: 16px; color: #333333; line-height: 1.6;">Thank you for registering. Please confirm your email by clicking the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background-color: #10b981; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 24px; font-weight: bold; font-size: 16px; display: inline-block;">Confirm Email</a>
          </div>
          <p style="font-size: 12px; color: #666666;">If the button above does not work, copy and paste this link in your browser:</p>
          <p style="font-size: 12px; color: #10b981; word-break: break-all;">${verificationUrl}</p>
        </div>
      `,
      uz: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #10b981; text-align: center;">CaloFit ilovasiga xush kelibsiz! 🥗</h2>
          <p style="font-size: 16px; color: #333333; line-height: 1.6;">Ro'yxatdan o'tganingiz uchun tashakkur. Iltimos, quyidagi tugmani bosish orqali pochtangizni tasdiqlang:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background-color: #10b981; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 24px; font-weight: bold; font-size: 16px; display: inline-block;">Pochtani tasdiqlash</a>
          </div>
          <p style="font-size: 12px; color: #666666;">Agar tugma ishlamasa, ushbu havolani brauzerga nusxalab joylang:</p>
          <p style="font-size: 12px; color: #10b981; word-break: break-all;">${verificationUrl}</p>
        </div>
      `,
    };

    const htmlContent = htmlContentMap[locale] || htmlContentMap.uz;

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: this.fromAddress,
          to: email,
          subject,
          html: htmlContent,
        });
        this.logger.log(`Verification email sent successfully to: ${email}`);
      } catch (err) {
        this.logger.error(
          `Failed to send verification email to: ${email}`,
          err,
        );
      }
    } else {
      // Dev mode: log to console with big visible banner
      this.logger.log(
        '\n' +
          '========================================================================\n' +
          `📧 [DEVELOPMENT MODE: VERIFICATION EMAIL FOR ${email}]\n` +
          `Subject: ${subject}\n` +
          `Verification Link:\n` +
          `👉 ${verificationUrl}\n` +
          '========================================================================',
      );
    }
  }
}
