package com.bottino.monitoring.config;

import com.bottino.monitoring.model.*;
import com.bottino.monitoring.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements CommandLineRunner {
    
    @Autowired
    private UserRepository userRepository;
    
    @Autowired
    private StatusVariableRepository statusRepository;
    
    @Autowired
    private AnalogVariableRepository analogRepository;
    
    @Autowired
    private CommandVariableRepository commandRepository;
    
    @Override
    public void run(String... args) throws Exception {
        // Create demo users if none exist
        if (userRepository.count() == 0) {
            // User 1: Without Schneider config (first time login)
            User user1 = new User();
            user1.setUsername("bottino");
            user1.setPassword("bottino123");
            user1.setHasToken(false);
            user1.setToken(null);
            user1.setHasSchneiderConfig(false);
            user1.setSchneiderUsername(null);
            user1.setSchneiderPassword(null);
            user1.setRtuIp(null);
            userRepository.save(user1);
            
            // User 2: With Schneider config already set (demo)
            User user2 = new User();
            user2.setUsername("admin");
            user2.setPassword("admin123");
            user2.setHasToken(true);
            user2.setToken("ADMIN_TOKEN_2024");
            user2.setHasSchneiderConfig(true);
            user2.setSchneiderUsername("Engineer");
            user2.setSchneiderPassword("Engineer1!");
            user2.setRtuIp("192.168.2.1");
            userRepository.save(user2);
            
            System.out.println("✓ Demo users created:");
            System.out.println("  - Username: bottino, Password: bottino123, Token: BOTTINO_SECRET_TOKEN_2024");
            System.out.println("    (First time login - will require Schneider config)");
            System.out.println("  - Username: admin, Password: admin123, Token: ADMIN_TOKEN_2024");
            System.out.println("    (Already configured - direct access)");
            System.out.println("  - Schneider demo credentials: schneider / schneider123 / 192.168.1.100");
        }
    }
}
