package at.repository;

import at.dtos.AuthResult;
import at.dtos.LoginDTO;
import at.dtos.UserDTO;
import at.model.User;
import at.security.TokenService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.transaction.Transactional;
import org.mindrot.jbcrypt.BCrypt;

import java.util.List;

@ApplicationScoped
public class UserRepository {
    @Inject
    EntityManager em;

    @Inject
    TokenService tokenService;

    @Transactional
    public User save(User user) {
        em.persist(user);
        return user;
    }

    public User findByEmail(String email) {
        try {
            return em.createQuery("SELECT u FROM User u WHERE u.email = :email", User.class)
                    .setParameter("email", email)
                    .getSingleResult();
        } catch (NoResultException e) {
            return null;
        }
    }

    public User findByUsername(String username) {
        try {
            return em.createQuery("SELECT u FROM User u WHERE u.username = :username", User.class)
                    .setParameter("username", username)
                    .getSingleResult();
        } catch (NoResultException e) {
            return null;
        }
    }

    @Transactional
    public AuthResult register(UserDTO dto) {
        if (dto == null || dto.username() == null || dto.username().isBlank()
                || dto.email() == null || dto.email().isBlank()
                || dto.password() == null || dto.password().isBlank()) {
            return AuthResult.failure("INVALID_DATA", "Username, E‑Mail und Passwort sind erforderlich.");
        }

        if (findByUsername(dto.username()) != null) {
            return AuthResult.failure("USERNAME_TAKEN", "Der Benutzername ist bereits vergeben.");
        }

        if (findByEmail(dto.email()) != null) {
            return AuthResult.failure("EMAIL_TAKEN", "Die E‑Mail ist bereits registriert.");
        }

        String hashed = BCrypt.hashpw(dto.password(), BCrypt.gensalt());
        User user = new User(dto.username(), dto.email(), hashed);
        User saved = save(user);

        // Token erzeugen statt Passwort-Hash zurückzugeben
        String token = tokenService.createToken(saved.getId());
        return AuthResult.success(saved.getId(), token);
    }

    public AuthResult login(LoginDTO dto) {
        if (dto == null || dto.email() == null || dto.email().isBlank()
                || dto.password() == null || dto.password().isBlank()) {
            return AuthResult.failure("INVALID_DATA", "E‑Mail und Passwort sind erforderlich.");
        }

        User user = findByEmail(dto.email());
        if (user == null) {
            return AuthResult.failure("INVALID_CREDENTIALS", "Ungültige Zugangsdaten.");
        }

        boolean ok = BCrypt.checkpw(dto.password(), user.getPassword());
        if (!ok) {
            return AuthResult.failure("INVALID_CREDENTIALS", "Ungültige Zugangsdaten.");
        }

        // Token erzeugen statt Passwort-Hash zurückzugeben
        String token = tokenService.createToken(user.getId());
        return AuthResult.success(user.getId(), token);
    }

    /**
     * Validiert ein JWT\/Token: Token -> userId via TokenService -> existierender User?
     */
    public boolean validateToken(String token) {
        if (token == null || token.isBlank()) return false;

        Long userId = tokenService.validateTokenAndGetUserId(token);
        if (userId == null) return false;

        try {
            User user = em.find(User.class, userId);
            return user != null;
        } catch (Exception e) {
            return false;
        }
    }

    public UserDTO toUserDTO(User admin) {
        if (admin == null) return null;
        return new UserDTO(admin.getUsername(), admin.getEmail(), admin.getPassword());
    }

    public User findById(Long userId) {
        if (userId == null) return null;
        return em.find(User.class, userId);
    }
}