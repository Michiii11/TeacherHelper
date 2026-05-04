package at.websocket;

import at.security.TokenService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.websocket.CloseReason;
import jakarta.websocket.OnClose;
import jakarta.websocket.OnError;
import jakarta.websocket.OnOpen;
import jakarta.websocket.Session;
import jakarta.websocket.server.PathParam;
import jakarta.websocket.server.ServerEndpoint;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@ApplicationScoped
@ServerEndpoint("/socket/collection/{collectionId}")
public class CollectionSocket {

    private static final Map<UUID, Set<Session>> sessionsByCollection = new ConcurrentHashMap<>();

    @Inject
    TokenService tokenService;

    @OnOpen
    public void onOpen(Session session, @PathParam("collectionId") String rawCollectionId) throws IOException {
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

        UUID collectionId;

        try {
            collectionId = UUID.fromString(rawCollectionId);
        } catch (IllegalArgumentException e) {
            session.close(new CloseReason(
                    CloseReason.CloseCodes.VIOLATED_POLICY,
                    "Invalid collectionId"
            ));
            return;
        }

        session.getUserProperties().put("userId", userId);
        session.getUserProperties().put("collectionId", collectionId);

        sessionsByCollection
                .computeIfAbsent(collectionId, ignored -> ConcurrentHashMap.newKeySet())
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

        try {
            session.close();
        } catch (Exception ignored) {
        }
    }

    public static void broadcast(UUID collectionId) {
        if (collectionId == null) {
            return;
        }

        Set<Session> sessions = sessionsByCollection.get(collectionId);

        if (sessions == null || sessions.isEmpty()) {
            return;
        }

        sessions.removeIf(session -> !session.isOpen());

        if (sessions.isEmpty()) {
            sessionsByCollection.remove(collectionId);
            return;
        }

        for (Session session : sessions) {
            session.getAsyncRemote().sendText("update");
        }
    }

    private void removeSession(Session session) {
        Object rawCollectionId = session.getUserProperties().get("collectionId");

        if (!(rawCollectionId instanceof UUID collectionId)) {
            return;
        }

        Set<Session> sessions = sessionsByCollection.get(collectionId);

        if (sessions == null) {
            return;
        }

        sessions.remove(session);

        if (sessions.isEmpty()) {
            sessionsByCollection.remove(collectionId);
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