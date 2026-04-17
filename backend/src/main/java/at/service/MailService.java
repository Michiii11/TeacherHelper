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

    public void sendRegistrationVerification(String email, String token) {
        String link = frontendUrl + "/login?verifyToken=" + token;

        String subject = "Please confirm your email";
        String preheader = "Confirm your email address and activate your account.";
        String title = "Confirm Email";
        String intro = "Welcome to " + APP_NAME + ". Please confirm your email address to activate your account.";
        String buttonText = "Confirm Email";
        String hint = "If you did not register, you can safely ignore this email.";

        MailMessage message = baseMessage(email, subject);
        message.setText(buildTextVersion(title, intro, buttonText, link, hint));
        message.setHtml(buildHtmlMail(preheader, title, intro, buttonText, link, hint, "Account Activation"));

        sendMail(message);
    }

    public void sendEmailChangeVerification(String email, String token) {
        String link = frontendUrl + "/login?verifyToken=" + token;

        String subject = "Please confirm your new email";
        String preheader = "Confirm your new email address.";
        String title = "Confirm New Email";
        String intro = "You requested a change of your email address. Please confirm this change using the button below.";
        String buttonText = "Confirm New Email";
        String hint = "If you did not request this change, please ignore this email. Your current address will remain unchanged.";

        MailMessage message = baseMessage(email, subject);
        message.setText(buildTextVersion(title, intro, buttonText, link, hint));
        message.setHtml(buildHtmlMail(preheader, title, intro, buttonText, link, hint, "Email Change"));

        sendMail(message);
    }

    public void sendPasswordReset(String email, String token) {
        String link = frontendUrl + "/login?resetToken=" + token;

        String subject = "Reset your password";
        String preheader = "Securely reset your password.";
        String title = "Reset Password";
        String intro = "We received a request to reset your password. Click the button below to set a new password.";
        String buttonText = "Reset Password";
        String hint = "If you did not request this, you can ignore this email. Your password will remain unchanged.";

        MailMessage message = baseMessage(email, subject);
        message.setText(buildTextVersion(title, intro, buttonText, link, hint));
        message.setHtml(buildHtmlMail(preheader, title, intro, buttonText, link, hint, "Security Action"));

        sendMail(message);
    }

    private MailMessage baseMessage(String email, String subject) {
        MailMessage message = new MailMessage();
        message.setFrom(FROM_EMAIL);
        message.setTo(email);
        message.setSubject(subject);
        return message;
    }

    private String buildTextVersion(String title, String intro, String buttonText, String link, String hint) {
        return """
                %s

                %s

                %s:
                %s

                %s

                %s
                """.formatted(
                APP_NAME,
                title,
                buttonText,
                link,
                hint,
                "This message was automatically sent by " + APP_NAME + "."
        );
    }

    private String buildHtmlMail(
            String preheader,
            String title,
            String intro,
            String buttonText,
            String link,
            String hint,
            String badgeText
    ) {
        return """
                <!DOCTYPE html>
                <html lang="en">
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
                                  Digital, clean and modern.
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
                                    If the button does not work
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
                                  This message was automatically sent by %s.<br>
                                  Please do not reply directly to this email.
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
                TEXT_COLOR,
                escapeHtml(title),
                MUTED_COLOR,
                escapeHtml(intro),
                escapeHtml(link),
                PRIMARY_COLOR,
                escapeHtml(buttonText),
                BORDER_COLOR,
                TEXT_COLOR,
                MUTED_COLOR,
                escapeHtml(link),
                MUTED_COLOR,
                escapeHtml(hint),
                BORDER_COLOR,
                MUTED_COLOR,
                APP_NAME,
                MUTED_COLOR,
                APP_NAME
        );
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