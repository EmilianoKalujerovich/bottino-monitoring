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
        // Create users if they don't exist yet (safe to run multiple times)
        createUserIfNotExists("bottino",      "bottino123",      "BOTTINO_TOKEN_2024",  "configurador", true,  true,  "Engineer", "Engineer1!", "192.168.2.1");
        createUserIfNotExists("admin",        "admin123",        "ADMIN_TOKEN_2024",    "configurador", true,  true,  "Engineer", "Engineer1!", "192.168.2.1");
        createUserIfNotExists("configurador", "configurador123", "CONFIG_TOKEN_2024",   "configurador", true,  false, null, null, null);
        createUserIfNotExists("operador",     "operador123",     "OPERADOR_TOKEN_2024", "operador",     true,  false, null, null, null);

        System.out.println("✓ Users ready:");
        System.out.println("  - bottino      / bottino123      (configurador) token: BOTTINO_TOKEN_2024");
        System.out.println("  - admin        / admin123        (configurador) token: ADMIN_TOKEN_2024");
        System.out.println("  - configurador / configurador123 (configurador) token: CONFIG_TOKEN_2024");
        System.out.println("  - operador     / operador123     (operador)     token: OPERADOR_TOKEN_2024");
    }

    private void createUserIfNotExists(String username, String password, String token,
                                       String role, boolean hasToken, boolean hasSchneiderConfig,
                                       String schneiderUser, String schneiderPass, String rtuIp) {
        if (userRepository.findByUsername(username).isPresent()) return;

        User user = new User();
        user.setUsername(username);
        user.setPassword(password);
        user.setToken(token);
        user.setRole(role);
        user.setHasToken(hasToken);
        user.setHasSchneiderConfig(hasSchneiderConfig);
        user.setSchneiderUsername(schneiderUser);
        user.setSchneiderPassword(schneiderPass);
        user.setRtuIp(rtuIp);
        userRepository.save(user);
    }
}
