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
            return new LoginResponse(false, false, false, "Invalid credentials", null, null);
        }

        User user = userOpt.get();

        if (!user.getHasToken()) {
            return new LoginResponse(true, true, true, "Invalid token", null, user.getRole());
        }

        return new LoginResponse(true, false, false, "", null, user.getRole());
    }

    public LoginResponse validateToken(String username, String token) {
        Optional<User> userOpt = userRepository.findByUsername(username);

        if (userOpt.isEmpty()) {
            return new LoginResponse(false, false, false, "User not found", null, null);
        }

        User user = userOpt.get();

        if (user.getToken() == null || !user.getToken().equals(token)) {
            return new LoginResponse(false, false, false, "Invalid token", null, null);
        }

        String sessionToken = UUID.randomUUID().toString();
        user.setHasToken(true);
        userRepository.save(user);
        return new LoginResponse(true, false, false, "Login successful", sessionToken, user.getRole());
    }

    public LoginResponse saveSchneiderConfig(String username, String schneiderUsername,
                                             String schneiderPassword, String rtuIp) {
        Optional<User> userOpt = userRepository.findByUsername(username);

        if (userOpt.isEmpty()) {
            return new LoginResponse(false, false, false, "User not found", null, null);
        }

        boolean isValid = validateSchneiderCredentials(schneiderUsername, schneiderPassword, rtuIp);

        if (!isValid) {
            return new LoginResponse(false, false, false,
                "Incorrect Schneider credentials. Please contact desarrollo@ingbottino.com", null, null);
        }

        User user = userOpt.get();
        user.setSchneiderUsername(schneiderUsername);
        user.setSchneiderPassword(schneiderPassword);
        user.setRtuIp(rtuIp);
        user.setHasSchneiderConfig(true);
        userRepository.save(user);

        return new LoginResponse(true, false, false, "Configuration saved successfully", null, user.getRole());
    }

    public User getUserConfig(String username) {
        return userRepository.findByUsername(username).orElse(null);
    }

    private boolean validateSchneiderCredentials(String username, String password, String rtuIp) {
        if (username == null || username.trim().isEmpty()) return false;
        if (password == null || password.trim().isEmpty()) return false;
        if (rtuIp == null || rtuIp.trim().isEmpty()) return false;
        return true;
    }
}
