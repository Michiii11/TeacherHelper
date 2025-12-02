package at.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Base64;
import java.util.Date;

@ApplicationScoped
public class TokenService {

    private static final Logger log = Logger.getLogger(TokenService.class);

    @ConfigProperty(name = "app.jwt.secret")
    String jwtSecret; // kann Base64-kodiert oder plain UTF-8 sein

    private Key key;

    @PostConstruct
    void init() {
        // secret muss lang genug sein (z. B. 256 Bit+) — in Prod aus Config/Secret-Store
        key = Keys.hmacShaKeyFor(jwtSecret.getBytes());
    }

    public String createToken(Long userId) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .setSubject(String.valueOf(userId))
                .setIssuedAt(new Date(now))
                .setExpiration(new Date(now + 48 * 60 * 60 * 1000))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    /**
     * Validiert das JWT und liefert die userId zurück (subject / 'sub').
     * Gibt null zurück bei ungültigem Token.
     */
    public Long validateTokenAndGetUserId(String token) {
        try {
            byte[] keyBytes;
            try {
                keyBytes = Base64.getDecoder().decode(jwtSecret);
            } catch (IllegalArgumentException ex) {
                // kein gültiges Base64, fallback auf UTF-8 Bytes
                keyBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
            }

            Claims claims = Jwts.parserBuilder()
                    .setSigningKey(Keys.hmacShaKeyFor(keyBytes))
                    .build()
                    .parseClaimsJws(token)
                    .getBody();

            String sub = claims.getSubject();
            if (sub == null) return null;
            return Long.valueOf(sub);
        } catch (Exception e) {
            log.warn("Token validation failed: " + e.getMessage());
            return null;
        }
    }
}