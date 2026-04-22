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
import java.util.UUID;

@ApplicationScoped
public class TokenService {

    private static final Logger log = Logger.getLogger(TokenService.class);

    @ConfigProperty(name = "app.jwt.secret")
    String jwtSecret;

    private Key key;

    @PostConstruct
    void init() {
        key = Keys.hmacShaKeyFor(jwtSecret.getBytes());
    }

    public String createToken(UUID userId) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .setSubject(userId.toString())
                .setIssuedAt(new Date(now))
                .setExpiration(new Date(now + 48 * 60 * 60 * 1000))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public UUID validateTokenAndGetUserId(String token) {
        try {
            Claims claims = Jwts.parserBuilder()
                    .setSigningKey(key)
                    .build()
                    .parseClaimsJws(token)
                    .getBody();

            String sub = claims.getSubject();
            if (sub == null || sub.isBlank()) return null;
            return UUID.fromString(sub);
        } catch (Exception e) {
            log.warn("Token validation failed: " + e.getMessage());
            return null;
        }
    }
}