package at.dtos.Example;

import at.enums.ExampleTypes;
import at.enums.GapFillType;
import at.model.helper.Assign;
import at.model.helper.Focus;
import at.model.helper.Option;

import java.util.List;
import java.util.UUID;

public record CreateExampleDTO(
        String authToken,
        Long schoolId,
        ExampleTypes type,
        String instruction,
        String question,
        List<String[]> answers,
        List<Option> options,
        GapFillType gapFillType,
        List<GapDTO> gaps,
        List<Assign> assigns,
        List<String> assignRightItems,
        String image,
        String solution,
        String solutionUrl,
        List<Focus> focusList,
        List<ExampleVariableDTO> variables,
        Integer imageWidth,
        Integer solutionImageWidth,
        UUID folderId
) {
}
