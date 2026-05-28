package com.bottino.monitoring.controller;

import com.bottino.monitoring.model.Panel;
import com.bottino.monitoring.model.User;
import com.bottino.monitoring.repository.PanelRepository;
import com.bottino.monitoring.repository.UserRepository;
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

    @Autowired
    private UserRepository userRepository;

    // All users can GET all panels (shared)
    @GetMapping
    public ResponseEntity<List<Panel>> getPanels(
            @RequestHeader(value = "X-Username", required = false) String username) {
        if (username == null || username.isBlank()) return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(panelRepository.findAll());
    }

    // Only configurador role can create panels
    @PostMapping
    public ResponseEntity<?> createPanel(
            @RequestBody Panel panel,
            @RequestHeader(value = "X-Username", required = false) String username) {
        if (username == null || username.isBlank()) return ResponseEntity.badRequest().build();
        if (!isConfigurador(username)) return ResponseEntity.status(403).body(Map.of("error", "Solo el configurador puede crear paneles"));
        panel.setId(null);
        panel.setUsername(username);
        return ResponseEntity.ok(panelRepository.save(panel));
    }

    // Only configurador role can update panels
    @PutMapping("/{id}")
    public ResponseEntity<?> updatePanel(
            @PathVariable Long id,
            @RequestBody Panel panel,
            @RequestHeader(value = "X-Username", required = false) String username) {
        if (!isConfigurador(username)) return ResponseEntity.status(403).body(Map.of("error", "Solo el configurador puede modificar paneles"));
        Optional<Panel> existing = panelRepository.findById(id);
        if (existing.isEmpty()) return ResponseEntity.notFound().build();
        panel.setId(id);
        panel.setUsername(existing.get().getUsername());
        return ResponseEntity.ok(panelRepository.save(panel));
    }

    // Only configurador role can delete panels
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deletePanel(
            @PathVariable Long id,
            @RequestHeader(value = "X-Username", required = false) String username) {
        Map<String, Object> result = new HashMap<>();
        if (!isConfigurador(username)) {
            result.put("success", false); result.put("message", "Solo el configurador puede eliminar paneles");
            return ResponseEntity.status(403).body(result);
        }
        Optional<Panel> existing = panelRepository.findById(id);
        if (existing.isEmpty()) { result.put("success", false); result.put("message", "Panel not found"); return ResponseEntity.ok(result); }
        panelRepository.deleteById(id);
        result.put("success", true);
        return ResponseEntity.ok(result);
    }

    private boolean isConfigurador(String username) {
        if (username == null || username.isBlank()) return false;
        Optional<User> user = userRepository.findByUsername(username);
        return user.isPresent() && "configurador".equals(user.get().getRole());
    }
}
