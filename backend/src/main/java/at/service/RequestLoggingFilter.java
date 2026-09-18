package at.service;

import jakarta.annotation.Priority;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.container.ContainerResponseFilter;
import jakarta.ws.rs.ext.Provider;
import org.jboss.logging.Logger;

import java.io.IOException;
import java.util.UUID;

@Provider
@Priority(Priorities.USER)
public class RequestLoggingFilter implements ContainerRequestFilter, ContainerResponseFilter {

    private static final Logger LOG = Logger.getLogger(RequestLoggingFilter.class);

    private static final String PROP_START_NANOS =
            RequestLoggingFilter.class.getName() + ".startNanos";
    private static final String PROP_REQUEST_ID =
            RequestLoggingFilter.class.getName() + ".requestId";

    @Override
    public void filter(ContainerRequestContext requestContext) {
        requestContext.setProperty(PROP_START_NANOS, System.nanoTime());

        String incomingRequestId = requestContext.getHeaderString("X-Request-Id");
        String requestId = isSafeRequestId(incomingRequestId)
                ? incomingRequestId
                : UUID.randomUUID().toString();

        requestContext.setProperty(PROP_REQUEST_ID, requestId);
    }

    @Override
    public void filter(ContainerRequestContext requestContext,
                       ContainerResponseContext responseContext) throws IOException {

        long durationMs = durationMs(requestContext.getProperty(PROP_START_NANOS));
        String requestId = String.valueOf(requestContext.getProperty(PROP_REQUEST_ID));
        String method = requestContext.getMethod();
        String path = requestContext.getUriInfo().getPath();
        int status = responseContext.getStatus();

        responseContext.getHeaders().putSingle("X-Request-Id", requestId);

        if (status >= 500) {
            LOG.errorf(
                    "event=http.request method=%s path=%s status=%d durationMs=%d requestId=%s",
                    method, path, status, durationMs, requestId
            );
        } else if (status >= 400) {
            LOG.warnf(
                    "event=http.request method=%s path=%s status=%d durationMs=%d requestId=%s",
                    method, path, status, durationMs, requestId
            );
        } else if (LOG.isDebugEnabled()) {
            LOG.debugf(
                    "event=http.request method=%s path=%s status=%d durationMs=%d requestId=%s",
                    method, path, status, durationMs, requestId
            );
        }
    }

    private long durationMs(Object rawStartNanos) {
        if (!(rawStartNanos instanceof Long startNanos)) {
            return -1L;
        }

        return Math.max(0L, (System.nanoTime() - startNanos) / 1_000_000L);
    }

    private boolean isSafeRequestId(String value) {
        return value != null
                && !value.isBlank()
                && value.length() <= 100
                && value.matches("[A-Za-z0-9._:-]+");
    }
}
