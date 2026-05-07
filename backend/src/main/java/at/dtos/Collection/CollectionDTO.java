package at.dtos.Collection;

import at.dtos.Example.ExampleDTO;
import at.dtos.Example.ExampleOverviewDTO;
import at.dtos.Test.TestOverviewDTO;
import at.dtos.User.UserDTO;

import java.util.List;
import java.util.UUID;

public record CollectionDTO(
        UUID id,
        String name,
        String logoUrl,
        UserDTO admin,
        List<ExampleOverviewDTO> examples,
        List<TestOverviewDTO> tests,
        List<UserDTO> members
) {
}