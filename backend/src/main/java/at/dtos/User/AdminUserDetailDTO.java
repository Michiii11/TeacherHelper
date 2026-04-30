package at.dtos.User;

import at.dtos.School.SchoolDTO;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record AdminUserDetailDTO(
        UUID id,
        List<SchoolDTO> schools
) {
}