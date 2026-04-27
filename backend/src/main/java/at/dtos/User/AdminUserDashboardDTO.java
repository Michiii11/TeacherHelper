package at.dtos.User;

import java.time.LocalDateTime;
import java.util.UUID;

public record AdminUserDashboardDTO(
        UUID id,
        String username,
        LocalDateTime createdAt,
        LocalDateTime lastActive,
        long collections,
        long examples,
        long tests
) {
}