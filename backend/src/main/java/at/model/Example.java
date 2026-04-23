package at.model;

import at.dtos.Example.GapDTO;
import at.enums.ExampleTypes;
import at.enums.GapFillType;
import at.model.helper.Assign;
import at.model.helper.ExampleVariable;
import at.model.helper.Focus;
import at.model.helper.Gap;
import at.model.helper.Option;
import jakarta.persistence.*;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;
import java.util.UUID;

@Entity
public class Example {
    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne
    private User admin;

    @ManyToOne
    private School school;

    @ManyToOne
    @JoinColumn(name = "folder_id")
    private Folder folder;

    @Enumerated(EnumType.STRING)
    private ExampleTypes type;

    private String instruction;
    private String question;
    private String solution;
    private String solutionUrl;
    private String imageUrl;

    private Integer imageWidth;
    private Integer solutionImageWidth;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "example_focus",
            joinColumns = @JoinColumn(name = "example_id"),
            inverseJoinColumns = @JoinColumn(name = "focus_id")
    )
    private List<Focus> focusList = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "example_variables", joinColumns = @JoinColumn(name = "example_id"))
    @OrderColumn(name = "variable_order")
    private List<ExampleVariable> variables = new ArrayList<>();

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

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Example() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

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
                ", school=" + school +
                ", folder=" + folder +
                ", type=" + type +
                ", instruction='" + instruction + '\'' +
                ", question='" + question + '\'' +
                ", solution='" + solution + '\'' +
                ", solutionUrl='" + solutionUrl + '\'' +
                ", imageUrl='" + imageUrl + '\'' +
                ", imageWidth=" + imageWidth +
                ", solutionImageWidth=" + solutionImageWidth +
                ", focusList=" + focusList +
                ", variables=" + variables +
                ", answers=" + answers +
                ", options=" + options +
                ", gapFillType=" + gapFillType +
                ", gaps=" + gaps +
                ", assigns=" + assigns +
                ", assignRightItems=" + assignRightItems +
                ", createdAt=" + createdAt +
                ", updatedAt=" + updatedAt +
                '}';
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
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
    public String getSolutionUrl() { return solutionUrl; }
    public void setSolutionUrl(String solutionUrl) { this.solutionUrl = solutionUrl; }
    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }
    public Integer getImageWidth() { return imageWidth; }
    public void setImageWidth(Integer imageWidth) { this.imageWidth = imageWidth; }
    public Integer getSolutionImageWidth() { return solutionImageWidth; }
    public void setSolutionImageWidth(Integer solutionImageWidth) { this.solutionImageWidth = solutionImageWidth; }
    public List<Focus> getFocusList() { return focusList; }
    public void setFocusList(List<Focus> focusList) { this.focusList = focusList; }
    public List<ExampleVariable> getVariables() { return variables; }
    public void setVariables(List<ExampleVariable> variables) { this.variables = variables != null ? new ArrayList<>(variables) : new ArrayList<>(); }
    public List<String[]> getAnswers() { return answers; }
    public void setAnswers(List<String[]> answers) { this.answers = answers; }
    public List<Option> getOptions() { return options; }
    public void setOptions(List<Option> options) { this.options = options; }
    public GapFillType getGapFillType() { return gapFillType; }
    public void setGapFillType(GapFillType gapFillType) { this.gapFillType = gapFillType; }
    public List<Gap> getGaps() { return gaps; }
    public void setGaps(List<Gap> gaps) { this.gaps = gaps; }
    public List<GapDTO> getGapDTO() {
        List<GapDTO> dtos = new LinkedList<>();
        for (Gap g : getGaps()) {
            dtos.add(new GapDTO(g.getId(), g.getLabel(), g.getSolution(), g.getWidth(), new LinkedList<>(g.getOptions())));
        }
        return dtos;
    }
    public List<Assign> getAssigns() { return assigns; }
    public void setAssigns(List<Assign> assigns) { this.assigns = assigns; }
    public List<String> getAssignRightItems() { return assignRightItems; }
    public void setAssignRightItems(List<String> assignRightItems) { this.assignRightItems = assignRightItems; }
    public School getSchool() { return school; }
    public void setSchool(School school) { this.school = school; }
    public Folder getFolder() { return folder; }
    public void setFolder(Folder folder) { this.folder = folder; }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
