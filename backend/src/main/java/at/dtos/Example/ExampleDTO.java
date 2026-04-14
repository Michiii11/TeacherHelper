package at.dtos.Example;

import at.dtos.School.SchoolDTO;
import at.dtos.User.UserDTO;
import at.enums.ExampleTypes;
import at.enums.GapFillType;
import at.model.helper.Assign;
import at.model.helper.Focus;
import at.model.helper.Option;

import java.util.List;

public record ExampleDTO(
        Long id,
        UserDTO admin,
        ExampleTypes type,
        String instruction,
        String question,
        String solution,
        String solutionUrl,
        String imageUrl,
        Integer imageWidth,
        Integer solutionImageWidth,
        List<Focus> focusList,
        SchoolDTO school,
        List<String[]> answers,
        List<Option> options,
        GapFillType gapFillType,
        List<GapDTO> gaps,
        List<Assign> assigns,
        List<String> assignRightItems
) {
}