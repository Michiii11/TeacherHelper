package at.dtos;

import java.util.List;

public record SchoolDTO(Long id, String name, UserDTO admin, int exampleCount, List<UserDTO> members) {
}
