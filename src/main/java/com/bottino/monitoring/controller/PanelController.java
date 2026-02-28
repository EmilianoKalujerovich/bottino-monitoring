package com.bottino.monitoring.controller;

import com.bottino.monitoring.model.Panel;
import com.bottino.monitoring.repository.PanelRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/panels")
public class PanelController {

    @Autowired
    private PanelRepository panelRepository;

    @GetMapping
    public ResponseEntity<List<Panel>> getPanels(
            @RequestHeader(value = "X-Username", required = false) String username) {
        if (username == null || username.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(panelRepository.findByUsername(username));
    }

    @PostMapping
    public ResponseEntity<Panel> createPanel(
            @RequestBody Panel panel,
            @RequestHeader(value = "X-Username", required = false) String username) {
        if (username == null || username.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        panel.setId(null);
        panel.setUsername(username);
        return ResponseEntity.ok(panelRepository.save(panel));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Panel> updatePanel(
            @PathVariable Long id,
            @RequestBody Panel panel,
            @RequestHeader(value = "X-Username", required = false) String username) {
        Optional<Panel> existing = panelRepository.findById(id);
        if (existing.isEmpty()) return ResponseEntity.notFound().build();
        if (!existing.get().getUsername().equals(username)) return ResponseEntity.status(403).build();
        panel.setId(id);
        panel.setUsername(username);
        return ResponseEntity.ok(panelRepository.save(panel));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deletePanel(
            @PathVariable Long id,
            @RequestHeader(value = "X-Username", required = false) String username) {
        Optional<Panel> existing = panelRepository.findById(id);
        Map<String, Object> result = new HashMap<>();
        if (existing.isEmpty()) { result.put("success", false); result.put("message", "Panel not found"); return ResponseEntity.ok(result); }
        if (!existing.get().getUsername().equals(username)) return ResponseEntity.status(403).build();
        panelRepository.deleteById(id);
        result.put("success", true);
        return ResponseEntity.ok(result);
    }
}
