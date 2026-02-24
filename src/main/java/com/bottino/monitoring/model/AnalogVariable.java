package com.bottino.monitoring.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "analog_variables")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AnalogVariable {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, length = 100)
    private String name;
    
    @Column(name = "variable_value", nullable = false, length = 500)
    private String value;
    
    @Column(length = 255)
    private String description;
}
