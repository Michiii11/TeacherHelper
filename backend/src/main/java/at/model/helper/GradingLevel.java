package at.model.helper;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class GradingLevel {
    @Column(name = "grade_key", length = 80)
    private String key;

    @Column(name = "label", length = 120)
    private String label;

    @Column(name = "short_label", length = 40)
    private String shortLabel;

    @Column(name = "display_order")
    private Integer order;

    @Column(name = "percentage_from")
    private Integer percentageFrom;

    @Column(name = "minimum_points")
    private Integer minimumPoints;

    public GradingLevel() {
    }

    public GradingLevel(String key, String label, String shortLabel, Integer order, Integer percentageFrom, Integer minimumPoints) {
        this.key = key;
        this.label = label;
        this.shortLabel = shortLabel;
        this.order = order;
        this.percentageFrom = percentageFrom;
        this.minimumPoints = minimumPoints;
    }

    public String getKey() {
        return key;
    }

    public void setKey(String key) {
        this.key = key;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public String getShortLabel() {
        return shortLabel;
    }

    public void setShortLabel(String shortLabel) {
        this.shortLabel = shortLabel;
    }

    public Integer getOrder() {
        return order;
    }

    public void setOrder(Integer order) {
        this.order = order;
    }

    public Integer getPercentageFrom() {
        return percentageFrom;
    }

    public void setPercentageFrom(Integer percentageFrom) {
        this.percentageFrom = percentageFrom;
    }

    public Integer getMinimumPoints() {
        return minimumPoints;
    }

    public void setMinimumPoints(Integer minimumPoints) {
        this.minimumPoints = minimumPoints;
    }
}
