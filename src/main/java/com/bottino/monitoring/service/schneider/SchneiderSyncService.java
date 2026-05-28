package com.bottino.monitoring.service.schneider;

import com.bottino.monitoring.dto.SchneiderVariable;
import com.bottino.monitoring.model.*;
import com.bottino.monitoring.repository.*;
import com.bottino.monitoring.service.VariableHistoryService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;

@Service
public class SchneiderSyncService {

   @Autowired
   private SchneiderService schneiderService;

   @Autowired
   private StatusVariableRepository statusRepository;

   @Autowired
   private AnalogVariableRepository analogRepository;

   @Autowired
   private CommandVariableRepository commandRepository;

   @Autowired
   private UserRepository userRepository;

   @Autowired
   private VariableHistoryService variableHistoryService;

   private String currentActiveTab = "status";

   private String currentUsername = null;

   // Prevent concurrent sync operations
   private final AtomicBoolean isSyncing = new AtomicBoolean(false);

   public void setActiveTab(String tab, String username) {
      this.currentActiveTab = tab;
      this.currentUsername = username;
   }

   /**
    * Sync variables every 1 minute
    */
   @Scheduled(fixedRate = 10000) // 30 seconds in milliseconds
   public void syncVariables() {
      // Skip if already syncing
      if (!isSyncing.compareAndSet(false, true)) {
         System.out.println("⏸️  Sync already in progress, skipping this cycle...");
         return;
      }

      try {
         if (currentUsername == null) {
            return;
         }

         // Check if user has Schneider configured
         User user = userRepository.findByUsername(currentUsername).orElse(null);
         if (user == null || !user.getHasSchneiderConfig()) {
            return;
         }

         System.out.println("🔄 Syncing all variables with Schneider...");

         syncStatusVariables();
         syncAnalogVariables();
         syncCommandVariables();
      } catch (Exception e) {
         System.err.println("❌ Error syncing variables: " + e.getMessage());
         e.printStackTrace();
      } finally {
         isSyncing.set(false);
      }
   }

   private void syncStatusVariables() {
      List<SchneiderVariable> schneiderVars = schneiderService.getAllVariablesWithValues("status", currentUsername);
      Map<String, SchneiderVariable> schneiderMap = schneiderVars.stream().collect(Collectors.toMap(SchneiderVariable::getName, v -> v));

      List<StatusVariable> ourVars = statusRepository.findAll();

      for (StatusVariable var : ourVars) {
         SchneiderVariable schneiderVar = schneiderMap.get(var.getName());

         if (schneiderVar != null) {
            // Variable EXISTS in Schneider, update value
            var.setValue(schneiderVar.getValue());
            var.setDescription(" ");
         } else {
            // Variable DOES NOT EXIST in Schneider
            var.setValue("-99");
            var.setDescription("Variable not found in Schneider system 🚨");
         }

         statusRepository.save(var);

         // Record history if enabled
         variableHistoryService.recordValueIfEnabled(var.getId(), "status", var.getName(), var.getValue());
      }

      System.out.println("✓ Status variables synced: " + ourVars.size() + " variables processed");
   }

   private void syncAnalogVariables() {
      List<SchneiderVariable> schneiderVars = schneiderService.getAllVariablesWithValues("analog", currentUsername);
      Map<String, SchneiderVariable> schneiderMap = schneiderVars.stream().collect(Collectors.toMap(SchneiderVariable::getName, v -> v));

      List<AnalogVariable> ourVars = analogRepository.findAll();

      for (AnalogVariable var : ourVars) {
         SchneiderVariable schneiderVar = schneiderMap.get(var.getName());

         if (schneiderVar != null) {
            var.setValue(schneiderVar.getValue());
            var.setDescription(" ");
         } else {
            var.setValue("-99");
            var.setDescription("Variable not found in Schneider system 🚨");
         }

         analogRepository.save(var);

         // Record history if enabled
         variableHistoryService.recordValueIfEnabled(var.getId(), "analog", var.getName(), var.getValue());
      }

      System.out.println("✓ Analog variables synced: " + ourVars.size() + " variables processed");
   }

   private void syncCommandVariables() {
      List<SchneiderVariable> schneiderVars = schneiderService.getAllVariablesWithValues("command", currentUsername);
      Map<String, SchneiderVariable> schneiderMap = schneiderVars.stream().collect(Collectors.toMap(SchneiderVariable::getName, v -> v));

      List<CommandVariable> ourVars = commandRepository.findAll();

      for (CommandVariable var : ourVars) {
         SchneiderVariable schneiderVar = schneiderMap.get(var.getName());

         if (schneiderVar != null) {
            var.setValue(schneiderVar.getValue());
            var.setDescription(" ");
         } else {
            // Variable DOES NOT EXIST in Schneider
            var.setValue("-99");
            var.setDescription("Variable not found in Schneider system 🚨");
         }

         commandRepository.save(var);

         // Record history if enabled
         variableHistoryService.recordValueIfEnabled(var.getId(), "command", var.getName(), var.getValue());
      }

      System.out.println("✓ Command variables synced: " + ourVars.size() + " variables processed");
   }

   /**
    * Sync all variables of a given type for a user — called after bulk import.
    */
   public void syncAllVariablesForType(String type, String username) {
      User user = userRepository.findByUsername(username).orElse(null);
      if (user == null || !user.getHasSchneiderConfig()) {
         return;
      }

      currentUsername = username;
      currentActiveTab = type;

      System.out.println("🔄 Post-import sync for " + type + " variables...");

      switch (type) {
         case "status":
            syncStatusVariables();
            break;
         case "analog":
            syncAnalogVariables();
            break;
         case "command":
            syncCommandVariables();
            break;
      }
   }

   /**
    * Sync single variable when created/imported
    * This method waits if a sync is already in progress
    */
   public void syncSingleVariable(String name, String type, String username) {
      // Wait for ongoing sync to complete (max 10 seconds)
      int attempts = 0;
      while (isSyncing.get() && attempts < 20) {
         try {
            Thread.sleep(500);
            attempts++;
         } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            break;
         }
      }

      User user = userRepository.findByUsername(username).orElse(null);
      if (user == null || !user.getHasSchneiderConfig()) {
         return;
      }

      try {
         List<SchneiderVariable> schneiderVars = schneiderService.getAllVariablesWithValues(type, username);
         SchneiderVariable schneiderVar = schneiderVars.stream().filter(v -> v.getName().equals(name)).findFirst().orElse(null);

         if (schneiderVar != null) {
            updateVariableValue(name, schneiderVar.getValue(), type);
         } else {
            updateVariableValue(name, "-99", type);
            updateVariableDescription(name, "Variable not found in Schneider system", type);
         }
      } catch (Exception e) {
         System.err.println("❌ Error syncing single variable: " + e.getMessage());
      }
   }

   private void updateVariableValue(String name, String value, String type) {
      switch (type) {
         case "status":
            statusRepository.findAll().stream().filter(v -> v.getName().equals(name)).findFirst().ifPresent(v -> {
               v.setValue(value);
               statusRepository.save(v);
            });
            break;
         case "analog":
            analogRepository.findAll().stream().filter(v -> v.getName().equals(name)).findFirst().ifPresent(v -> {
               v.setValue(value);
               analogRepository.save(v);
            });
            break;
         case "command":
            commandRepository.findAll().stream().filter(v -> v.getName().equals(name)).findFirst().ifPresent(v -> {
               v.setValue(value);
               commandRepository.save(v);
            });
            break;
      }
   }

   private void updateVariableDescription(String name, String additionalDesc, String type) {
      switch (type) {
         case "status":
            statusRepository.findAll().stream().filter(v -> v.getName().equals(name)).findFirst().ifPresent(v -> {
               String currentDesc = v.getDescription() != null ? v.getDescription() : "";
               if (!currentDesc.contains(additionalDesc)) {
                  v.setDescription(currentDesc.isEmpty() ? additionalDesc : currentDesc + " - " + additionalDesc);
                  statusRepository.save(v);
               }
            });
            break;
         case "analog":
            analogRepository.findAll().stream().filter(v -> v.getName().equals(name)).findFirst().ifPresent(v -> {
               String currentDesc = v.getDescription() != null ? v.getDescription() : "";
               if (!currentDesc.contains(additionalDesc)) {
                  v.setDescription(currentDesc.isEmpty() ? additionalDesc : currentDesc + " - " + additionalDesc);
                  analogRepository.save(v);
               }
            });
            break;
         case "command":
            commandRepository.findAll().stream().filter(v -> v.getName().equals(name)).findFirst().ifPresent(v -> {
               String currentDesc = v.getDescription() != null ? v.getDescription() : "";
               if (!currentDesc.contains(additionalDesc)) {
                  v.setDescription(currentDesc.isEmpty() ? additionalDesc : currentDesc + " - " + additionalDesc);
                  commandRepository.save(v);
               }
            });
            break;
      }
   }
}
