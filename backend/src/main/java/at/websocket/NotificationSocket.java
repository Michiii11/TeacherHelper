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

@ApplicationScoped
@ServerEndpoint("/socket/notification")
public class NotificationSocket {

    private static final Set<Session> SESSIONS = new CopyOnWriteArraySet<>();

    @OnOpen
    public void onOpen(Session session) {
        SESSIONS.add(session);
    }

    @OnClose
    public void onClose(Session session) {
        SESSIONS.remove(session);
    }

    @OnError
    public void onError(Session session, Throwable throwable) {
        if (throwable != null) {
            throwable.printStackTrace();
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