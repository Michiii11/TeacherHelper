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
        sendTokenMail(email, token, language, MailType.REGISTRATION);
    }

    public void sendEmailChangeVerification(String email, String token, String language) {
        sendTokenMail(email, token, language, MailType.EMAIL_CHANGE);
    }

    public void sendPasswordReset(String email, String token, String language) {
        sendTokenMail(email, token, language, MailType.PASSWORD_RESET);
    }

    private void sendTokenMail(String email, String token, String language, MailType type) {
        String lang = normalizeLanguage(language);
        String link = buildFrontendLink(type.queryParam, token);

        MailContent content = new MailContent(
                t(lang, type.key + ".subject"),
                t(lang, type.key + ".preheader"),
                t(lang, type.key + ".title"),
                t(lang, type.key + ".intro"),
                t(lang, type.key + ".button"),
                t(lang, type.key + ".hint"),
                t(lang, type.key + ".badge")
        );

        MailMessage message = baseMessage(email, content.subject());
        message.setText(buildTextVersion(content, link, lang, token));
        message.setHtml(buildHtmlMail(content, link, lang, token));
        sendMail(message);
    }

    private String buildFrontendLink(String queryParam, String token) {
        return frontendUrl + "/login?" + queryParam + "=" + token;
    }

    private MailMessage baseMessage(String email, String subject) {
        MailMessage message = new MailMessage();
        message.setFrom(FROM_EMAIL);
        message.setTo(email);
        message.setSubject(subject);
        return message;
    }

    private String buildTextVersion(MailContent content, String link, String language, String token) {
        return """
        %s

        %s

        Code: %s

        Link:
        %s

        %s
        """.formatted(
                APP_NAME,
                content.title(),
                token,
                link,
                content.hint()
        );
    }

    private String buildHtmlMail(MailContent content, String link, String language, String token) {
        return """
        <!DOCTYPE html>
        <html lang="%s">
        <body style="margin:0; padding:0; background:%s; font-family:Arial;">

          <div style="max-width:600px; margin:40px auto; background:white; padding:30px; border-radius:16px;">

            <h2 style="text-align:center;">%s</h2>

            <p style="text-align:center;">%s</p>

            <!-- 🔥 CODE -->
            <div style="
              font-size:36px;
              font-weight:800;
              letter-spacing:8px;
              text-align:center;
              margin:30px 0;
            ">
              %s
            </div>

            <p style="text-align:center; color:#666;">
              Code gültig für 15 Minuten
            </p>

            <hr style="margin:30px 0;">

            <!-- BUTTON -->
            <div style="text-align:center;">
              <a href="%s"
                style="
                  display:inline-block;
                  padding:12px 24px;
                  background:#2563eb;
                  color:white;
                  border-radius:10px;
                  text-decoration:none;
                  font-weight:600;
                ">
                %s
              </a>
            </div>

            <!-- FALLBACK -->
            <p style="margin-top:20px; font-size:12px; text-align:center;">
              Falls der Button nicht funktioniert:
            </p>

            <p style="font-size:12px; word-break:break-all; text-align:center;">
              %s
            </p>

          </div>
        </body>
        </html>
        """.formatted(
                language,
                BACKGROUND_COLOR,
                content.title(),
                content.intro(),
                token,
                link,
                content.buttonText(),
                link
        );
    }

    private String normalizeLanguage(String language) {
        return "de".equalsIgnoreCase(language) ? "de" : "en";
    }

    private String t(String language, String key) {
        String lang = normalizeLanguage(language);

        return switch (lang + ":" + key) {
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

    private enum MailType {
        REGISTRATION("registration", "verifyToken"),
        EMAIL_CHANGE("emailChange", "verifyToken"),
        PASSWORD_RESET("passwordReset", "resetToken");

        private final String key;
        private final String queryParam;

        MailType(String key, String queryParam) {
            this.key = key;
            this.queryParam = queryParam;
        }
    }

    private record MailContent(
            String subject,
            String preheader,
            String title,
            String intro,
            String buttonText,
            String hint,
            String badgeText
    ) {
    }
}