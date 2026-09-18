package at.websocket;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.websocket.OnClose;
import jakarta.websocket.OnError;
import jakarta.websocket.OnOpen;
import jakarta.websocket.Session;
import jakarta.websocket.server.ServerEndpoint;

import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import org.jboss.logging.Logger;

@ApplicationScoped
@ServerEndpoint("/socket/notification")
public class NotificationSocket {
    private static final Logger LOG = Logger.getLogger(NotificationSocket.class);

    private static final Set<Session> SESSIONS = new CopyOnWriteArraySet<>();

    @OnOpen
    public void onOpen(Session session) {
        SESSIONS.add(session);
        LOG.debugf("event=socket.notification.open sessionId=%s active=%d", session.getId(), SESSIONS.size());
    }

    @OnClose
    public void onClose(Session session) {
        SESSIONS.remove(session);
        LOG.debugf("event=socket.notification.close sessionId=%s active=%d", session.getId(), SESSIONS.size());
    }

    @OnError
    public void onError(Session session, Throwable throwable) {
        String sessionId = session != null ? session.getId() : "unknown";
        if (throwable != null) {
            LOG.errorf(throwable, "event=socket.notification.error sessionId=%s", sessionId);
        } else {
            LOG.warnf("event=socket.notification.error sessionId=%s error=unknown", sessionId);
        }

        if (session != null) {
            SESSIONS.remove(session);
        }
    }

    public static void notifyUser(UUID userId) {
        if (userId == null) {
            return;
        }

        SESSIONS.removeIf(session -> !session.isOpen());

        for (Session session : SESSIONS) {
            session.getAsyncRemote().sendText("refresh");
        }
    }
}