package at.model;

import jakarta.persistence.*;

import java.sql.Timestamp;
import java.util.*;

@Entity
public class Test {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    private User admin;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String note;

    private int duration;

    @OneToMany(mappedBy = "test", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<TestExample> exampleList = new ArrayList<>();

    @ManyToOne
    private School school;

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

    @ManyToOne
    @JoinColumn(name = "folder_id")
    private Folder folder;

    private Timestamp createdAt;
    private Timestamp updatedAt;

    public Test() {
        createdAt = new Timestamp(System.currentTimeMillis());
        updatedAt = new Timestamp(System.currentTimeMillis());
    }

    public Test(String name, String note, User admin, School school, int duration) {
        super();
        this.name = name;
        this.note = note;
        this.school = school;
        this.admin = admin;
        this.duration = duration;
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

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
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

    public Timestamp getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Timestamp createdAt) {
        this.createdAt = createdAt;
    }

    public Timestamp getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Timestamp updatedAt) {
        this.updatedAt = updatedAt;
    }
}
