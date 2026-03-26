// src/main/java/at/model/Example.java
package at.model;

import at.dtos.Example.GapDTO;
import at.enums.ExampleTypes;
import at.enums.GapFillType;
import at.model.helper.Assign;
import at.model.helper.Focus;
import at.model.helper.Gap;
import at.model.helper.Option;
import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;

@Entity
public class Example {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    private User admin;

    @Enumerated(EnumType.STRING)
    private ExampleTypes type;

    private String instruction;

    private String question;

    private String solution;

    private String solutionUrl;

    private String imageUrl;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "example_focus",
            joinColumns = @JoinColumn(name = "example_id"),
            inverseJoinColumns = @JoinColumn(name = "focus_id")
    )
    private List<Focus> focusList = new ArrayList<>();

    @ManyToOne
    private School school;

    @ElementCollection
    @CollectionTable(name = "example_answers", joinColumns = @JoinColumn(name = "example_id"))
    private List<String[]> answers = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "example_options", joinColumns = @JoinColumn(name = "example_id"))
    private List<Option> options = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    private GapFillType gapFillType;

    @OneToMany(mappedBy = "example", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Gap> gaps = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "example_assigns", joinColumns = @JoinColumn(name = "example_id"))
    private List<Assign> assigns = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "example_assign_right_items", joinColumns = @JoinColumn(name = "example_id"))
    @Column(name = "right_item")
    private List<String> assignRightItems = new ArrayList<>();

    public Example() {}

    public Example(User admin, ExampleTypes type, String instruction, String question, String solution, School school) {
        this.admin = admin;
        this.type = type;
        this.instruction = instruction;
        this.question = question;
        this.solution = solution;
        this.school = school;
    }

    @Override
    public String toString() {
        return "Example{" +
                "id=" + id +
                ", admin=" + admin +
                ", type=" + type +
                ", instruction='" + instruction + '\'' +
                ", question='" + question + '\'' +
                ", answer='" + solution + '\'' +
                ", imageUrl='" + imageUrl + '\'' +
                ", school=" + school +
                ", answers=" + answers +
                ", options=" + options +
                ", gapFillType=" + gapFillType +
                ", gaps=" + gaps +
                ", assigns=" + assigns +
                ", assignRightItems=" + assignRightItems +
                '}';
    }

    // Getter und Setter (gekürzt für Übersichtlichkeit)
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getAdmin() { return admin; }
    public void setAdmin(User admin) { this.admin = admin; }

    public ExampleTypes getType() { return type; }
    public void setType(ExampleTypes type) { this.type = type; }

    public String getInstruction() { return instruction; }
    public void setInstruction(String instruction) { this.instruction = instruction; }

    public String getQuestion() { return question; }
    public void setQuestion(String question) { this.question = question; }

    public String getSolution() { return solution; }
    public void setSolution(String solution) { this.solution = solution; }

    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }

    public List<String[]> getAnswers() { return answers; }
    public void setAnswers(List<String[]> answers) { this.answers = answers; }

    public List<Option> getOptions() { return options; }
    public void setOptions(List<Option> options) { this.options = options; }

    public GapFillType getGapFillType() { return gapFillType; }
    public void setGapFillType(GapFillType gapFillType) { this.gapFillType = gapFillType; }

    public List<Gap> getGaps() { return gaps; }
    public void setGaps(List<Gap> gaps) {
        this.gaps = gaps;
    }

    public List<GapDTO> getGapDTO() {
        List<GapDTO> dtos = new LinkedList<>();
        for(Gap g : getGaps()){
            dtos.add(new GapDTO(g.getId(), g.getLabel(), g.getSolution(), g.getOptions()));
        }
        return dtos;
    }

    public List<Assign> getAssigns() { return assigns; }
    public void setAssigns(List<Assign> assigns) { this.assigns = assigns; }

    public List<String> getAssignRightItems() { return assignRightItems; }
    public void setAssignRightItems(List<String> assignRightItems) { this.assignRightItems = assignRightItems; }

    public School getSchool() { return school; }
    public void setSchool(School school) { this.school = school; }

    public String getSolutionUrl() {
        return solutionUrl;
    }

    public void setSolutionUrl(String solutionUrl) {
        this.solutionUrl = solutionUrl;
    }

    public List<Focus> getFocusList() {
        return focusList;
    }

    public void setFocusList(List<Focus> focusList) {
        this.focusList = focusList;
    }
}