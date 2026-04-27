package at.websocket;

import at.security.TokenService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.websocket.CloseReason;
import jakarta.websocket.OnClose;
import jakarta.websocket.OnError;
import jakarta.websocket.OnOpen;
import jakarta.websocket.Session;
import jakarta.websocket.server.ServerEndpoint;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

@ApplicationScoped
@ServerEndpoint("/socket/notification")
public class NotificationSocket {

    private static final ConcurrentHashMap<UUID, Set<Session>> USER_SESSIONS = new ConcurrentHashMap<>();

    @Inject
    TokenService tokenService;

    @OnOpen
    public void onOpen(Session session) throws IOException {
        String token = extractToken(session.getQueryString());

        if (token == null || token.isBlank()) {
            session.close(new CloseReason(
                    CloseReason.CloseCodes.VIOLATED_POLICY,
                    "Missing token"
            ));
            return;
        }

        UUID userId = tokenService.validateTokenAndGetUserId(token);

        if (userId == null) {
            session.close(new CloseReason(
                    CloseReason.CloseCodes.VIOLATED_POLICY,
                    "Invalid token"
            ));
            return;
        }

        session.getUserProperties().put("userId", userId);
        USER_SESSIONS
                .computeIfAbsent(userId, ignored -> new CopyOnWriteArraySet<>())
                .add(session);
    }

    @OnClose
    public void onClose(Session session) {
        removeSession(session);
    }

    @OnError
    public void onError(Session session, Throwable throwable) {
        if (throwable != null) {
            throwable.printStackTrace();
        }
        removeSession(session);
    }

    public static void notifyUser(UUID userId) {
        if (userId == null) {
            return;
        }

        Set<Session> sessions = USER_SESSIONS.get(userId);
        if (sessions == null || sessions.isEmpty()) {
            return;
        }

        sessions.removeIf(session -> !session.isOpen());

        for (Session session : sessions) {
            session.getAsyncRemote().sendText("refresh");
        }
    }

    private void removeSession(Session session) {
        Object rawUserId = session.getUserProperties().get("userId");

        if (!(rawUserId instanceof UUID userId)) {
            return;
        }

        Set<Session> sessions = USER_SESSIONS.get(userId);
        if (sessions == null) {
            return;
        }

        sessions.remove(session);

        if (sessions.isEmpty()) {
            USER_SESSIONS.remove(userId);
        }
    }

    private String extractToken(String queryString) {
        if (queryString == null || queryString.isBlank()) {
            return null;
        }

        String[] pairs = queryString.split("&");

        for (String pair : pairs) {
            String[] kv = pair.split("=", 2);

            if (kv.length == 2 && "token".equals(kv[0])) {
                return URLDecoder.decode(kv[1], StandardCharsets.UTF_8);
            }
        }

        return null;
    }
}