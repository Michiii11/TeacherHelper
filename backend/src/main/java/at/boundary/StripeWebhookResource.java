package at.boundary;

import at.service.StripeWebhookService;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.net.Webhook;
import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.nio.charset.StandardCharsets;
import java.util.Map;

@Path("/stripe/webhook")
public class StripeWebhookResource {

    private static final Logger LOG = Logger.getLogger(StripeWebhookResource.class);

    @Inject
    StripeWebhookService stripeWebhookService;

    @ConfigProperty(name = "stripe.webhook-secret")
    String webhookSecret;

    @POST
    @PermitAll
    @Consumes(MediaType.APPLICATION_JSON)
    public Response handleWebhook(
            byte[] body,
            @HeaderParam("Stripe-Signature") String signature
    ) {
        if (body == null || body.length == 0 || signature == null || signature.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("code", "INVALID_WEBHOOK_REQUEST"))
                    .build();
        }

        if (webhookSecret == null || webhookSecret.isBlank()) {
            LOG.error("event=stripe.webhook.secret-missing");
            return Response.serverError()
                    .entity(Map.of("code", "STRIPE_WEBHOOK_SECRET_NOT_CONFIGURED"))
                    .build();
        }

        final Event event;

        try {
            String payload = new String(body, StandardCharsets.UTF_8);
            event = Webhook.constructEvent(payload, signature, webhookSecret);
        } catch (SignatureVerificationException e) {
            LOG.warn("event=stripe.webhook.invalid-signature");
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("code", "INVALID_STRIPE_SIGNATURE"))
                    .build();
        } catch (RuntimeException e) {
            LOG.warnf(e, "event=stripe.webhook.invalid-payload");
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("code", "INVALID_STRIPE_PAYLOAD"))
                    .build();
        }

        try {
            stripeWebhookService.handle(event);
            return Response.ok(Map.of("received", true)).build();
        } catch (Exception e) {
            LOG.errorf(e, "event=stripe.webhook.processing-failed stripeEventId=%s stripeEventType=%s",
                    event.getId(), event.getType());

            return Response.serverError()
                    .entity(Map.of("code", "STRIPE_WEBHOOK_PROCESSING_FAILED"))
                    .build();
        }
    }
}
