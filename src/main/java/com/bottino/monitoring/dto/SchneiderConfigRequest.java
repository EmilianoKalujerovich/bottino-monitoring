package com.bottino.monitoring.dto;

import lombok.Data;

@Data
public class SchneiderConfigRequest {
    private String username;
    private String schneiderUsername;
    private String schneiderPassword;
    private String rtuIp;
}
