package com.bottino.monitoring.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class User {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true, length = 50)
    private String username;
    
    @Column(nullable = false, length = 255)
    private String password;
    
    @Column(nullable = false)
    private Boolean hasToken = true;
    
    @Column(length = 255)
    private String token;

    // Role: "configurador" or "operador"
    @Column(nullable = false, length = 20, columnDefinition = "varchar(20) default 'configurador'")
    private String role = "configurador";
    
    // Schneider RTU Configuration
    @Column(length = 100)
    private String schneiderUsername;
    
    @Column(length = 255)
    private String schneiderPassword;
    
    @Column(length = 50)
    private String rtuIp;
    
    @Column(nullable = false)
    private Boolean hasSchneiderConfig = false;
}
