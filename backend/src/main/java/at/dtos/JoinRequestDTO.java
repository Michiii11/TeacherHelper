package at.dtos;

import at.enums.RequestType;

public record JoinRequestDTO(SchoolDTO school, UserDTO transmitter, UserDTO recipient, String message, boolean accepted, boolean done, RequestType type) {
}
