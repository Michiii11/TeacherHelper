package at.dtos.Example;

import at.dtos.Folder.FolderDTO;
import at.dtos.School.SchoolDTO;
import at.dtos.User.UserDTO;
import at.enums.ExampleTypes;
import at.enums.GapFillType;
import at.model.helper.Assign;
import at.model.helper.Focus;
import at.model.helper.Option;

import java.util.List;
import java.util.UUID;

public record ExampleDTO(
        UUID id,
        UserDTO admin,
        FolderDTO folder,
        ExampleTypes type,
        String instruction,
        String question,
        String solution,
        String solutionUrl,
        String imageUrl,
        Integer imageWidth,
        Integer solutionImageWidth,
        List<Focus> focusList,
        List<ExampleVariableDTO> variables,
        SchoolDTO school,
        List<String[]> answers,
        List<Option> options,
        GapFillType gapFillType,
        List<GapDTO> gaps,
        List<Assign> assigns,
        List<String> assignRightItems
) {
}
