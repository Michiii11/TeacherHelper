package at.dtos;

public record JoinRequestDTO(SchoolDTO school, UserDTO user, String message, boolean accepted, boolean done) {
}
