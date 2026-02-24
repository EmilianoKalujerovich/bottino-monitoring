package com.bottino.monitoring.controller;

import com.bottino.monitoring.dto.LoginRequest;
import com.bottino.monitoring.dto.LoginResponse;
import com.bottino.monitoring.dto.SchneiderConfigRequest;
import com.bottino.monitoring.dto.TokenValidationRequest;
import com.bottino.monitoring.model.User;
import com.bottino.monitoring.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    
    @Autowired
    private AuthService authService;
    
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request) {
        LoginResponse response = authService.login(request.getUsername(), request.getPassword());
        
        if (!response.isSuccess()) {
            return ResponseEntity.status(401).body(response);
        }
        
        return ResponseEntity.ok(response);
    }
    
    @PostMapping("/validate-token")
    public ResponseEntity<LoginResponse> validateToken(@RequestBody TokenValidationRequest request) {
        LoginResponse response = authService.validateToken(request.getUsername(), request.getToken());
        
        if (!response.isSuccess()) {
            return ResponseEntity.status(401).body(response);
        }
        
        return ResponseEntity.ok(response);
    }
    
    @PostMapping("/schneider-config")
    public ResponseEntity<LoginResponse> saveSchneiderConfig(@RequestBody SchneiderConfigRequest request) {
        LoginResponse response = authService.saveSchneiderConfig(
            request.getUsername(),
            request.getSchneiderUsername(),
            request.getSchneiderPassword(),
            request.getRtuIp()
        );
        
        if (!response.isSuccess()) {
            return ResponseEntity.status(401).body(response);
        }
        
        return ResponseEntity.ok(response);
    }
    
    @GetMapping("/schneider-config/{username}")
    public ResponseEntity<Map<String, Object>> getSchneiderConfig(@PathVariable String username) {
        User user = authService.getUserConfig(username);
        
        if (user == null) {
            return ResponseEntity.notFound().build();
        }
        
        Map<String, Object> config = new HashMap<>();
        config.put("hasConfig", user.getHasSchneiderConfig());
        config.put("schneiderUsername", user.getSchneiderUsername());
        config.put("rtuIp", user.getRtuIp());
        // Don't send password to frontend for security
        
        return ResponseEntity.ok(config);
    }
}
