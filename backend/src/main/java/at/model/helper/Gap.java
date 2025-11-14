// src/main/java/at/model/Gap.java
package at.model.helper;

import at.model.Example;
import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "example_gaps")
public class Gap {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String label;

    @ElementCollection
    @CollectionTable(name = "gap_options", joinColumns = @JoinColumn(name = "gap_id"))
    private List<Option> options = new ArrayList<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "example_id")
    private Example example;

    public Gap() {}

    public Gap(String label, List<Option> options) {
        this.label = label;
        this.options = options;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }

    public List<Option> getOptions() { return options; }
    public void setOptions(List<Option> options) { this.options = options; }

    public Example getExample() { return example; }
    public void setExample(Example example) { this.example = example; }
}