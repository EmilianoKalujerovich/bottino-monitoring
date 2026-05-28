package com.bottino.monitoring.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "variable_history")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class VariableHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "variable_id", nullable = false)
    private Long variableId;

    @Column(name = "variable_type", nullable = false, length = 20)
    private String variableType; // "status", "analog", "command"

    @Column(name = "variable_name", nullable = false, length = 100)
    private String variableName;

    @Column(name = "variable_value", nullable = false, length = 500)
    private String value;

    @Column(name = "recorded_at", nullable = false)
    private LocalDateTime recordedAt;

    @Column(name = "is_max_tracking", nullable = false)
    private Boolean isMaxTracking = false;
}
