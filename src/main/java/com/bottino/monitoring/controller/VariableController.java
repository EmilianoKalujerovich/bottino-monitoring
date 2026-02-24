package com.bottino.monitoring.controller;

import com.bottino.monitoring.model.AnalogVariable;
import com.bottino.monitoring.model.CommandVariable;
import com.bottino.monitoring.model.StatusVariable;
import com.bottino.monitoring.service.VariableService;
import com.bottino.monitoring.service.schneider.SchneiderSyncService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/variables")
public class VariableController {

   @Autowired
   private VariableService variableService;

   @Autowired
   private SchneiderSyncService schneiderSyncService;

   // ========== STATUS VARIABLES ==========

   @GetMapping("/status")
   public ResponseEntity<List<StatusVariable>> getAllStatusVariables(@RequestHeader(value = "X-Username", required = false) String username) {
      if (username != null) {
         schneiderSyncService.setActiveTab("status", username);
      }
      return ResponseEntity.ok(variableService.getAllStatusVariables());
   }

   @PostMapping("/status")
   public ResponseEntity<StatusVariable> createStatusVariable(@RequestBody StatusVariable variable,
         @RequestHeader(value = "X-Username", required = false) String username) {
      return ResponseEntity.ok(variableService.saveStatusVariable(variable, username));
   }

   @PutMapping("/status/{id}")
   public ResponseEntity<StatusVariable> updateStatusVariable(@PathVariable Long id, @RequestBody StatusVariable variable,
         @RequestHeader(value = "X-Username", required = false) String username) {
      variable.setId(id);
      return ResponseEntity.ok(variableService.updateStatusVariable(variable, username));
   }

   @DeleteMapping("/status/{id}")
   public ResponseEntity<Void> deleteStatusVariable(@PathVariable Long id) {
      variableService.deleteStatusVariable(id);
      return ResponseEntity.ok().build();
   }

   @PostMapping("/status/import-csv")
   public ResponseEntity<Map<String, Object>> importStatusCSV(@RequestParam("file") MultipartFile file,
         @RequestHeader(value = "X-Username", required = false) String username) {
      try {
         int count = variableService.importStatusVariablesFromCSV(file, username);
         Map<String, Object> response = new HashMap<>();
         response.put("success", true);
         response.put("count", count);
         response.put("message", count + " status variables imported successfully");
         return ResponseEntity.ok(response);
      } catch (Exception e) {
         Map<String, Object> response = new HashMap<>();
         response.put("success", false);
         response.put("message", "Error importing CSV: " + e.getMessage());
         return ResponseEntity.badRequest().body(response);
      }
   }

   // ========== ANALOG VARIABLES ==========

   @GetMapping("/analog")
   public ResponseEntity<List<AnalogVariable>> getAllAnalogVariables(@RequestHeader(value = "X-Username", required = false) String username) {
      if (username != null) {
         schneiderSyncService.setActiveTab("analog", username);
      }
      return ResponseEntity.ok(variableService.getAllAnalogVariables());
   }

   @PostMapping("/analog")
   public ResponseEntity<AnalogVariable> createAnalogVariable(@RequestBody AnalogVariable variable,
         @RequestHeader(value = "X-Username", required = false) String username) {
      return ResponseEntity.ok(variableService.saveAnalogVariable(variable, username));
   }

   @PutMapping("/analog/{id}")
   public ResponseEntity<AnalogVariable> updateAnalogVariable(@PathVariable Long id, @RequestBody AnalogVariable variable,
         @RequestHeader(value = "X-Username", required = false) String username) {
      variable.setId(id);
      return ResponseEntity.ok(variableService.updateAnalogVariable(variable, username));
   }

   @DeleteMapping("/analog/{id}")
   public ResponseEntity<Void> deleteAnalogVariable(@PathVariable Long id) {
      variableService.deleteAnalogVariable(id);
      return ResponseEntity.ok().build();
   }

   @PostMapping("/analog/import-csv")
   public ResponseEntity<Map<String, Object>> importAnalogCSV(@RequestParam("file") MultipartFile file,
         @RequestHeader(value = "X-Username", required = false) String username) {
      try {
         int count = variableService.importAnalogVariablesFromCSV(file, username);
         Map<String, Object> response = new HashMap<>();
         response.put("success", true);
         response.put("count", count);
         response.put("message", count + " analog variables imported successfully");
         return ResponseEntity.ok(response);
      } catch (Exception e) {
         Map<String, Object> response = new HashMap<>();
         response.put("success", false);
         response.put("message", "Error importing CSV: " + e.getMessage());
         return ResponseEntity.badRequest().body(response);
      }
   }

   // ========== COMMAND VARIABLES ==========

   @GetMapping("/command")
   public ResponseEntity<List<CommandVariable>> getAllCommandVariables(@RequestHeader(value = "X-Username", required = false) String username) {
      if (username != null) {
         schneiderSyncService.setActiveTab("command", username);
      }
      return ResponseEntity.ok(variableService.getAllCommandVariables());
   }

   @PostMapping("/command")
   public ResponseEntity<CommandVariable> createCommandVariable(@RequestBody CommandVariable variable,
         @RequestHeader(value = "X-Username", required = false) String username) {
      return ResponseEntity.ok(variableService.saveCommandVariable(variable, username));
   }

   @PutMapping("/command/{id}")
   public ResponseEntity<CommandVariable> updateCommandVariable(@PathVariable Long id, @RequestBody CommandVariable variable,
         @RequestHeader(value = "X-Username", required = false) String username) {
      variable.setId(id);
      return ResponseEntity.ok(variableService.updateCommandVariable(variable, username));
   }

   @DeleteMapping("/command/{id}")
   public ResponseEntity<Void> deleteCommandVariable(@PathVariable Long id) {
      variableService.deleteCommandVariable(id);
      return ResponseEntity.ok().build();
   }

   @PostMapping("/command/import-csv")
   public ResponseEntity<Map<String, Object>> importCommandCSV(@RequestParam("file") MultipartFile file,
         @RequestHeader(value = "X-Username", required = false) String username) {
      try {
         int count = variableService.importCommandVariablesFromCSV(file, username);
         Map<String, Object> response = new HashMap<>();
         response.put("success", true);
         response.put("count", count);
         response.put("message", count + " command variables imported successfully");
         return ResponseEntity.ok(response);
      } catch (Exception e) {
         Map<String, Object> response = new HashMap<>();
         response.put("success", false);
         response.put("message", "Error importing CSV: " + e.getMessage());
         return ResponseEntity.badRequest().body(response);
      }
   }
}
