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
import org.jboss.logging.Logger;

@ApplicationScoped
@ServerEndpoint("/socket/collection/{collectionId}")
public class CollectionSocket {
    private static final Logger LOG = Logger.getLogger(CollectionSocket.class);

    private static final Map<UUID, Set<Session>> sessionsByCollection = new ConcurrentHashMap<>();

    @OnOpen
    public void onOpen(Session session, @PathParam("collectionId") String rawCollectionId) throws IOException {
        UUID collectionId;

        try {
            collectionId = UUID.fromString(rawCollectionId);
        } catch (IllegalArgumentException e) {
            LOG.warnf("event=socket.collection.invalid-id sessionId=%s", session.getId());
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

        LOG.debugf("event=socket.collection.open collectionId=%s sessionId=%s active=%d",
                collectionId, session.getId(), sessionsByCollection.get(collectionId).size());
    }

    @OnClose
    public void onClose(Session session) {
        LOG.debugf("event=socket.collection.close sessionId=%s", session.getId());
        removeSession(session);
    }

    @OnError
    public void onError(Session session, Throwable throwable) {
        String sessionId = session != null ? session.getId() : "unknown";
        if (throwable != null) {
            LOG.errorf(throwable, "event=socket.collection.error sessionId=%s", sessionId);
        } else {
            LOG.warnf("event=socket.collection.error sessionId=%s error=unknown", sessionId);
        }

        if (session != null) {
            removeSession(session);
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
}