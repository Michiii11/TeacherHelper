package at.websocket;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.websocket.CloseReason;
import jakarta.websocket.OnClose;
import jakarta.websocket.OnError;
import jakarta.websocket.OnOpen;
import jakarta.websocket.Session;
import jakarta.websocket.server.PathParam;
import jakarta.websocket.server.ServerEndpoint;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@ApplicationScoped
@ServerEndpoint("/socket/collection/{collectionId}")
public class CollectionSocket {

    private static final Map<UUID, Set<Session>> sessionsByCollection = new ConcurrentHashMap<>();

    @OnOpen
    public void onOpen(Session session, @PathParam("collectionId") String rawCollectionId) throws IOException {
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
}