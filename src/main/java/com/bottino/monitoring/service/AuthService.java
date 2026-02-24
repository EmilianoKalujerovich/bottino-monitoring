package com.bottino.monitoring.service;

import com.bottino.monitoring.dto.LoginResponse;
import com.bottino.monitoring.model.User;
import com.bottino.monitoring.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;

@Service
public class AuthService {

    @Autowired
    private UserRepository userRepository;

    public LoginResponse login(String username, String password) {
        Optional<User> userOpt = userRepository.findByUsernameAndPassword(username, password);

        if (userOpt.isEmpty()) {
            return new LoginResponse(false, false, false, "Invalid credentials", null);
        }

        User user = userOpt.get();

        // All users must have token enabled
        if (!user.getHasToken()) {
            return new LoginResponse(true, true, true, "Invalid token", null);
        }

        // User exists and has token enabled, require token validation
        return new LoginResponse(true, false, false, "", null);
    }

    public LoginResponse validateToken(String username, String token) {
        Optional<User> userOpt = userRepository.findByUsername(username);

        if (userOpt.isEmpty()) {
            return new LoginResponse(false, false, false, "User not found", null);
        }

        User user = userOpt.get();

        if (user.getToken() == null || !user.getToken().equals(token)) {
            return new LoginResponse(false, false, false, "Invalid token", null);
        }

        // Token is valid, go directly to main screen
        String sessionToken = UUID.randomUUID().toString();
        user.setHasToken(true);
        userRepository.save(user);
        return new LoginResponse(true, false, false, "Login successful", sessionToken);
    }

    public LoginResponse saveSchneiderConfig(String username, String schneiderUsername,
                                             String schneiderPassword, String rtuIp) {
        Optional<User> userOpt = userRepository.findByUsername(username);

        if (userOpt.isEmpty()) {
            return new LoginResponse(false, false, false, "User not found", null);
        }

        // Validate Schneider credentials
        boolean isValid = validateSchneiderCredentials(schneiderUsername, schneiderPassword, rtuIp);

        if (!isValid) {
            return new LoginResponse(false, false, false,
                "Incorrect Schneider credentials. Please contact desarrollo@ingbottino.com", null);
        }

        // Save configuration
        User user = userOpt.get();
        user.setSchneiderUsername(schneiderUsername);
        user.setSchneiderPassword(schneiderPassword);
        user.setRtuIp(rtuIp);
        user.setHasSchneiderConfig(true);
        userRepository.save(user);

        return new LoginResponse(true, false, false, "Configuration saved successfully", null);
    }

    public User getUserConfig(String username) {
        return userRepository.findByUsername(username).orElse(null);
    }

    private boolean validateSchneiderCredentials(String username, String password, String rtuIp) {
        // TODO: Implement actual Schneider RTU validation
        // For now, accept any non-empty values

        if (username == null || username.trim().isEmpty()) {
            return false;
        }
        if (password == null || password.trim().isEmpty()) {
            return false;
        }
        if (rtuIp == null || rtuIp.trim().isEmpty()) {
            return false;
        }

        // Make proper validation - accept "schneider" as valid username for demo
        return true;
    }
}
