package com.bottino.monitoring.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class LoginResponse {
    private boolean success;
    private boolean requiresToken;
    private boolean requiresSchneiderConfig;
    private String message;
    private String sessionToken;
    private String role;
}
