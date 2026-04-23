package at.service;

import io.vertx.ext.mail.MailClient;
import io.vertx.ext.mail.MailMessage;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@ApplicationScoped
public class MailService {

    @Inject
    MailClient client;

    @ConfigProperty(name = "frontend.url")
    String frontendUrl;

    private static final String FROM_EMAIL = "web.service.034@gmail.com";
    private static final String APP_NAME = "TeacherHelper";
    private static final String PRIMARY_COLOR = "#2563eb";
    private static final String BACKGROUND_COLOR = "#f4f7fb";
    private static final String CARD_COLOR = "#ffffff";
    private static final String TEXT_COLOR = "#0f172a";
    private static final String MUTED_COLOR = "#64748b";
    private static final String BORDER_COLOR = "#e2e8f0";

    public void sendRegistrationVerification(String email, String token, String language) {
        String lang = normalizeLanguage(language);
        String link = frontendUrl + "/login?verifyToken=" + token;

        String subject = t(lang, "registration.subject");
        String preheader = t(lang, "registration.preheader");
        String title = t(lang, "registration.title");
        String intro = t(lang, "registration.intro");
        String buttonText = t(lang, "registration.button");
        String hint = t(lang, "registration.hint");
        String badgeText = t(lang, "registration.badge");

        MailMessage message = baseMessage(email, subject);
        message.setText(buildTextVersion(title, intro, buttonText, link, hint, lang));
        message.setHtml(buildHtmlMail(preheader, title, intro, buttonText, link, hint, badgeText, lang));

        sendMail(message);
    }

    public void sendEmailChangeVerification(String email, String token, String language) {
        String lang = normalizeLanguage(language);
        String link = frontendUrl + "/login?verifyToken=" + token;

        String subject = t(lang, "emailChange.subject");
        String preheader = t(lang, "emailChange.preheader");
        String title = t(lang, "emailChange.title");
        String intro = t(lang, "emailChange.intro");
        String buttonText = t(lang, "emailChange.button");
        String hint = t(lang, "emailChange.hint");
        String badgeText = t(lang, "emailChange.badge");

        MailMessage message = baseMessage(email, subject);
        message.setText(buildTextVersion(title, intro, buttonText, link, hint, lang));
        message.setHtml(buildHtmlMail(preheader, title, intro, buttonText, link, hint, badgeText, lang));

        sendMail(message);
    }

    public void sendPasswordReset(String email, String token, String language) {
        String lang = normalizeLanguage(language);
        String link = frontendUrl + "/login?resetToken=" + token;

        String subject = t(lang, "passwordReset.subject");
        String preheader = t(lang, "passwordReset.preheader");
        String title = t(lang, "passwordReset.title");
        String intro = t(lang, "passwordReset.intro");
        String buttonText = t(lang, "passwordReset.button");
        String hint = t(lang, "passwordReset.hint");
        String badgeText = t(lang, "passwordReset.badge");

        MailMessage message = baseMessage(email, subject);
        message.setText(buildTextVersion(title, intro, buttonText, link, hint, lang));
        message.setHtml(buildHtmlMail(preheader, title, intro, buttonText, link, hint, badgeText, lang));

        sendMail(message);
    }

    private MailMessage baseMessage(String email, String subject) {
        MailMessage message = new MailMessage();
        message.setFrom(FROM_EMAIL);
        message.setTo(email);
        message.setSubject(subject);
        return message;
    }

    private String buildTextVersion(
            String title,
            String intro,
            String buttonText,
            String link,
            String hint,
            String language
    ) {
        return """
                %s

                %s

                %s:
                %s

                %s

                %s
                """.formatted(
                APP_NAME,
                title + "\n" + intro,
                buttonText,
                link,
                hint,
                t(language, "mail.footer.auto")
        );
    }

    private String buildHtmlMail(
            String preheader,
            String title,
            String intro,
            String buttonText,
            String link,
            String hint,
            String badgeText,
            String language
    ) {
        return """
                <!DOCTYPE html>
                <html lang="%s">
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>%s</title>
                </head>
                <body style="margin:0; padding:0; background:%s; font-family:Arial, Helvetica, sans-serif; color:%s;">
                  <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">
                    %s
                  </div>

                  <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" style="background:%s; margin:0; padding:18px 12px;">
                    <tr>
                      <td align="center">
                        <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px; margin:0 auto;">
                          <tr>
                            <td style="padding:0 0 10px 0; text-align:center;">
                              <div style="display:inline-block; padding:7px 14px; border-radius:999px; background:#dbeafe; color:%s; font-weight:700; font-size:12px; letter-spacing:0.2px;">
                                %s
                              </div>
                            </td>
                          </tr>

                          <tr>
                            <td style="background:%s; border:1px solid %s; border-radius:24px; overflow:hidden; box-shadow:0 10px 30px rgba(15,23,42,0.08);">
                              <div style="background:linear-gradient(135deg, #1d4ed8 0%%, #2563eb 55%%, #3b82f6 100%%); padding:22px 28px 20px; text-align:center;">
                                <div style="font-size:24px; line-height:1.15; font-weight:800; color:#ffffff; margin:0;">
                                  %s
                                </div>
                                <div style="margin-top:6px; font-size:13px; line-height:1.5; color:#dbeafe;">
                                  %s
                                </div>
                              </div>

                              <div style="padding:28px 30px 24px 30px;">
                                <div style="font-size:26px; line-height:1.15; font-weight:800; color:%s; margin:0 0 14px 0; text-align:center;">
                                  %s
                                </div>

                                <div style="font-size:15px; line-height:1.65; color:%s; margin:0 0 22px 0; text-align:center;">
                                  %s
                                </div>

                                <div style="text-align:center; margin:0 0 24px 0;">
                                  <a href="%s"
                                     style="display:inline-block; background:%s; color:#ffffff; text-decoration:none; font-size:15px; font-weight:700; padding:14px 24px; border-radius:12px;">
                                     %s
                                  </a>
                                </div>

                                <div style="background:#f8fafc; border:1px solid %s; border-radius:16px; padding:14px 16px; margin:0 0 20px 0;">
                                  <div style="font-size:12px; font-weight:700; color:%s; margin:0 0 6px 0;">
                                    %s
                                  </div>
                                  <div style="font-size:12px; line-height:1.6; color:%s; word-break:break-all;">
                                    %s
                                  </div>
                                </div>

                                <div style="font-size:13px; line-height:1.65; color:%s; margin:0 0 18px 0;">
                                  %s
                                </div>

                                <div style="height:1px; background:%s; margin:0 0 16px 0;"></div>

                                <div style="font-size:12px; line-height:1.65; color:%s; text-align:center;">
                                  %s<br>
                                  %s
                                </div>
                              </div>
                            </td>
                          </tr>

                          <tr>
                            <td style="padding:12px 8px 0 8px; text-align:center; font-size:12px; line-height:1.6; color:%s;">
                              © %s – TeacherHelper
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>
                """.formatted(
                escapeHtml(language),
                escapeHtml(title),
                BACKGROUND_COLOR,
                TEXT_COLOR,
                escapeHtml(preheader),
                BACKGROUND_COLOR,
                PRIMARY_COLOR,
                escapeHtml(badgeText),
                CARD_COLOR,
                BORDER_COLOR,
                APP_NAME,
                escapeHtml(t(language, "mail.hero.subtitle")),
                TEXT_COLOR,
                escapeHtml(title),
                MUTED_COLOR,
                escapeHtml(intro),
                escapeHtml(link),
                PRIMARY_COLOR,
                escapeHtml(buttonText),
                BORDER_COLOR,
                TEXT_COLOR,
                escapeHtml(t(language, "mail.buttonFallback")),
                MUTED_COLOR,
                escapeHtml(link),
                MUTED_COLOR,
                escapeHtml(hint),
                BORDER_COLOR,
                MUTED_COLOR,
                escapeHtml(t(language, "mail.footer.auto")),
                escapeHtml(t(language, "mail.footer.noReply")),
                MUTED_COLOR,
                APP_NAME
        );
    }

    private String normalizeLanguage(String language) {
        if (language == null) {
            return "en";
        }
        return "de".equalsIgnoreCase(language) ? "de" : "en";
    }

    private String t(String language, String key) {
        String lang = normalizeLanguage(language);

        return switch (lang + ":" + key) {
            // registration
            case "de:registration.subject" -> "Bitte bestätige deine E-Mail";
            case "en:registration.subject" -> "Please confirm your email";

            case "de:registration.preheader" -> "Bestätige deine E-Mail-Adresse und aktiviere dein Konto.";
            case "en:registration.preheader" -> "Confirm your email address and activate your account.";

            case "de:registration.title" -> "E-Mail bestätigen";
            case "en:registration.title" -> "Confirm Email";

            case "de:registration.intro" -> "Willkommen bei " + APP_NAME + ". Bitte bestätige deine E-Mail-Adresse, um dein Konto zu aktivieren.";
            case "en:registration.intro" -> "Welcome to " + APP_NAME + ". Please confirm your email address to activate your account.";

            case "de:registration.button" -> "E-Mail bestätigen";
            case "en:registration.button" -> "Confirm Email";

            case "de:registration.hint" -> "Falls du dich nicht registriert hast, kannst du diese E-Mail einfach ignorieren.";
            case "en:registration.hint" -> "If you did not register, you can safely ignore this email.";

            case "de:registration.badge" -> "Kontoaktivierung";
            case "en:registration.badge" -> "Account Activation";

            // email change
            case "de:emailChange.subject" -> "Bitte bestätige deine neue E-Mail";
            case "en:emailChange.subject" -> "Please confirm your new email";

            case "de:emailChange.preheader" -> "Bestätige deine neue E-Mail-Adresse.";
            case "en:emailChange.preheader" -> "Confirm your new email address.";

            case "de:emailChange.title" -> "Neue E-Mail bestätigen";
            case "en:emailChange.title" -> "Confirm New Email";

            case "de:emailChange.intro" -> "Du hast eine Änderung deiner E-Mail-Adresse angefordert. Bitte bestätige diese Änderung mit dem Button unten.";
            case "en:emailChange.intro" -> "You requested a change of your email address. Please confirm this change using the button below.";

            case "de:emailChange.button" -> "Neue E-Mail bestätigen";
            case "en:emailChange.button" -> "Confirm New Email";

            case "de:emailChange.hint" -> "Falls du diese Änderung nicht angefordert hast, ignoriere bitte diese E-Mail. Deine aktuelle Adresse bleibt unverändert.";
            case "en:emailChange.hint" -> "If you did not request this change, please ignore this email. Your current address will remain unchanged.";

            case "de:emailChange.badge" -> "E-Mail-Änderung";
            case "en:emailChange.badge" -> "Email Change";

            // password reset
            case "de:passwordReset.subject" -> "Setze dein Passwort zurück";
            case "en:passwordReset.subject" -> "Reset your password";

            case "de:passwordReset.preheader" -> "Setze dein Passwort sicher zurück.";
            case "en:passwordReset.preheader" -> "Securely reset your password.";

            case "de:passwordReset.title" -> "Passwort zurücksetzen";
            case "en:passwordReset.title" -> "Reset Password";

            case "de:passwordReset.intro" -> "Wir haben eine Anfrage zum Zurücksetzen deines Passworts erhalten. Klicke auf den Button unten, um ein neues Passwort festzulegen.";
            case "en:passwordReset.intro" -> "We received a request to reset your password. Click the button below to set a new password.";

            case "de:passwordReset.button" -> "Passwort zurücksetzen";
            case "en:passwordReset.button" -> "Reset Password";

            case "de:passwordReset.hint" -> "Falls du das nicht angefordert hast, kannst du diese E-Mail ignorieren. Dein Passwort bleibt unverändert.";
            case "en:passwordReset.hint" -> "If you did not request this, you can ignore this email. Your password will remain unchanged.";

            case "de:passwordReset.badge" -> "Sicherheitsaktion";
            case "en:passwordReset.badge" -> "Security Action";

            // generic mail
            case "de:mail.hero.subtitle" -> "Digital, klar und modern.";
            case "en:mail.hero.subtitle" -> "Digital, clean and modern.";

            case "de:mail.buttonFallback" -> "Falls der Button nicht funktioniert";
            case "en:mail.buttonFallback" -> "If the button does not work";

            case "de:mail.footer.auto" -> "Diese Nachricht wurde automatisch von " + APP_NAME + " gesendet.";
            case "en:mail.footer.auto" -> "This message was automatically sent by " + APP_NAME + ".";

            case "de:mail.footer.noReply" -> "Bitte antworte nicht direkt auf diese E-Mail.";
            case "en:mail.footer.noReply" -> "Please do not reply directly to this email.";

            default -> key;
        };
    }

    private String escapeHtml(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    public void sendMail(MailMessage message) {
        client.sendMail(message, result -> {
            if (result.succeeded()) {
                System.out.println("Email sent successfully to " + message.getTo());
            } else {
                System.out.println("Failed to send email: " + result.cause());
            }
        });
    }
}