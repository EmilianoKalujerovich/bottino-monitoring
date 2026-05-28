package com.bottino.monitoring.controller;

import com.bottino.monitoring.model.VariableHistory;
import com.bottino.monitoring.model.VariableHistoryConfig;
import com.bottino.monitoring.service.VariableHistoryService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/variables/history")
public class VariableHistoryController {

    @Autowired
    private VariableHistoryService historyService;

    /**
     * GET /api/variables/history/{type}/{id}/config
     * Returns whether history / max-history is enabled for a given variable
     */
    @GetMapping("/{type}/{id}/config")
    public ResponseEntity<Map<String, Object>> getConfig(
            @PathVariable String type,
            @PathVariable Long id) {
        return ResponseEntity.ok(historyService.getConfigStatus(id, type));
    }

    /**
     * POST /api/variables/history/{type}/{id}/enable
     * Body: { "mode": "history" | "max" }
     */
    @PostMapping("/{type}/{id}/enable")
    public ResponseEntity<VariableHistoryConfig> enable(
            @PathVariable String type,
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {

        String mode = body.getOrDefault("mode", "history");
        VariableHistoryConfig cfg = "max".equals(mode)
                ? historyService.enableMaxHistory(id, type)
                : historyService.enableHistory(id, type);
        return ResponseEntity.ok(cfg);
    }

    /**
     * POST /api/variables/history/{type}/{id}/disable
     * Body: { "mode": "history" | "max" }
     */
    @PostMapping("/{type}/{id}/disable")
    public ResponseEntity<VariableHistoryConfig> disable(
            @PathVariable String type,
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {

        String mode = body.getOrDefault("mode", "history");
        VariableHistoryConfig cfg = "max".equals(mode)
                ? historyService.disableMaxHistory(id, type)
                : historyService.disableHistory(id, type);
        return ResponseEntity.ok(cfg);
    }

    /**
     * GET /api/variables/history/{type}/{id}/data?trackingType=history|max
     */
    @GetMapping("/{type}/{id}/data")
    public ResponseEntity<List<VariableHistory>> getData(
            @PathVariable String type,
            @PathVariable Long id,
            @RequestParam(defaultValue = "history") String trackingType) {

        List<VariableHistory> records = "max".equals(trackingType)
                ? historyService.getMaxHistory(id, type)
                : historyService.getHistory(id, type);
        return ResponseEntity.ok(records);
    }
}
