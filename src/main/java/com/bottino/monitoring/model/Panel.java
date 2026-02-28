package com.bottino.monitoring.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "panels")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Panel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 50)
    private String username;

    @Lob
    @Column(name = "canvas_data", columnDefinition = "TEXT")
    private String canvasData;  // JSON: { symbols:[], connections:[] }
}
