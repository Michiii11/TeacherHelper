package at.websocket;

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
}