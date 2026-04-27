package at.model;

import at.model.helper.GradingLevel;
import jakarta.persistence.*;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Entity
public class Test {
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

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String note;

    private int duration;

    @OneToMany(mappedBy = "test", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<TestExample> exampleList = new ArrayList<>();

    @Column(name = "default_task_spacing")
    private Integer defaultTaskSpacing;

    @Column(name = "grading_mode", length = 20)
    private String gradingMode;

    @Column(name = "grading_system_name", length = 120)
    private String gradingSystemName;

    @ElementCollection
    @CollectionTable(name = "test_task_spacing", joinColumns = @JoinColumn(name = "test_id"))
    @MapKeyColumn(name = "example_id")
    @Column(name = "spacing_value")
    private Map<UUID, Integer> taskSpacingMap = new HashMap<>();

    @ElementCollection
    @CollectionTable(name = "test_grading_levels", joinColumns = @JoinColumn(name = "test_id"))
    @OrderColumn(name = "schema_order")
    private List<GradingLevel> gradingSchema = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "test_grade_percentages", joinColumns = @JoinColumn(name = "test_id"))
    @MapKeyColumn(name = "grade_value")
    @Column(name = "percentage_value")
    private Map<Integer, Integer> gradePercentages = new HashMap<>();

    @ElementCollection
    @CollectionTable(name = "test_manual_grade_minimums", joinColumns = @JoinColumn(name = "test_id"))
    @MapKeyColumn(name = "grade_value")
    @Column(name = "minimum_points")
    private Map<Integer, Integer> manualGradeMinimums = new HashMap<>();

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Test() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    public Test(String name, String note, User admin, School school, int duration) {
        super();
        this.name = name;
        this.note = note;
        this.school = school;
        this.admin = admin;
        this.duration = duration;
    }

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (this.createdAt == null) {
            this.createdAt = now;
        }
        this.updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    @Override
    public String toString() {
        return "Test{" +
                "id=" + id +
                ", admin=" + admin +
                ", school=" + school +
                ", folder=" + folder +
                ", name='" + name + '\'' +
                ", note='" + note + '\'' +
                ", duration=" + duration +
                ", exampleList=" + exampleList +
                ", defaultTaskSpacing=" + defaultTaskSpacing +
                ", gradingMode='" + gradingMode + '\'' +
                ", gradingSystemName='" + gradingSystemName + '\'' +
                ", taskSpacingMap=" + taskSpacingMap +
                ", gradingSchema=" + gradingSchema +
                ", gradePercentages=" + gradePercentages +
                ", manualGradeMinimums=" + manualGradeMinimums +
                ", createdAt=" + createdAt +
                ", updatedAt=" + updatedAt +
                '}';
    }

    public int getDuration() {
        return duration;
    }

    public void setDuration(int duration) {
        this.duration = duration;
    }

    public User getAdmin() {
        return admin;
    }

    public void setAdmin(User admin) {
        this.admin = admin;
    }

    public School getSchool() {
        return school;
    }

    public void setSchool(School school) {
        this.school = school;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public List<TestExample> getExampleList() {
        return exampleList;
    }

    public void setExampleList(List<TestExample> exampleList) {
        this.exampleList = exampleList;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public Integer getDefaultTaskSpacing() {
        return defaultTaskSpacing;
    }

    public void setDefaultTaskSpacing(Integer defaultTaskSpacing) {
        this.defaultTaskSpacing = defaultTaskSpacing;
    }

    public String getGradingMode() {
        return gradingMode;
    }

    public void setGradingMode(String gradingMode) {
        this.gradingMode = gradingMode;
    }

    public String getGradingSystemName() {
        return gradingSystemName;
    }

    public void setGradingSystemName(String gradingSystemName) {
        this.gradingSystemName = gradingSystemName;
    }

    public Map<UUID, Integer> getTaskSpacingMap() {
        return taskSpacingMap;
    }

    public void setTaskSpacingMap(Map<UUID, Integer> taskSpacingMap) {
        this.taskSpacingMap = taskSpacingMap != null ? new HashMap<>(taskSpacingMap) : new HashMap<>();
    }

    public List<GradingLevel> getGradingSchema() {
        return gradingSchema;
    }

    public void setGradingSchema(List<GradingLevel> gradingSchema) {
        this.gradingSchema = gradingSchema != null ? new ArrayList<>(gradingSchema) : new ArrayList<>();
    }

    public Map<Integer, Integer> getGradePercentages() {
        return gradePercentages;
    }

    public void setGradePercentages(Map<Integer, Integer> gradePercentages) {
        this.gradePercentages = gradePercentages != null ? new HashMap<>(gradePercentages) : new HashMap<>();
    }

    public Map<Integer, Integer> getManualGradeMinimums() {
        return manualGradeMinimums;
    }

    public void setManualGradeMinimums(Map<Integer, Integer> manualGradeMinimums) {
        this.manualGradeMinimums = manualGradeMinimums != null ? new HashMap<>(manualGradeMinimums) : new HashMap<>();
    }

    public Folder getFolder() {
        return folder;
    }

    public void setFolder(Folder folder) {
        this.folder = folder;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
