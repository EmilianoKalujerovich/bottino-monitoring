package com.bottino.monitoring.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "variable_history_config")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class VariableHistoryConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "variable_id", nullable = false)
    private Long variableId;

    @Column(name = "variable_type", nullable = false, length = 20)
    private String variableType; // "status", "analog", "command"

    @Column(name = "save_history", nullable = false)
    private Boolean saveHistory = false;

    @Column(name = "save_max_history", nullable = false)
    private Boolean saveMaxHistory = false;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
