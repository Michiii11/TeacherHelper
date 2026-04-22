package at.dtos.User;

import java.sql.Timestamp;
import java.util.List;

public record AdminUserDashboardDTO (
        Long id, String username, String email, Timestamp createdAt, Timestamp lastActive, int collections, int examples, int tests
){
}
