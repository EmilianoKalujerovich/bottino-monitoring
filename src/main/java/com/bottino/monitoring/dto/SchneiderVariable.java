package com.bottino.monitoring.dto;

import lombok.Data;
import java.util.List;

@Data
public class SchneiderVariable {
    private String name;
    private String description;
    private String value;
    private boolean existsInSchneider;
}
