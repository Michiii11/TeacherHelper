package at.dtos.School;

import java.time.Instant;

public record LastActivityDTO (String username, Instant createdAt) {
}
