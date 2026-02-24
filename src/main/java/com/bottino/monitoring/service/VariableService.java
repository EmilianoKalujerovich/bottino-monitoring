package com.bottino.monitoring.service;

import com.bottino.monitoring.model.AnalogVariable;
import com.bottino.monitoring.model.CommandVariable;
import com.bottino.monitoring.model.StatusVariable;
import com.bottino.monitoring.repository.AnalogVariableRepository;
import com.bottino.monitoring.repository.CommandVariableRepository;
import com.bottino.monitoring.repository.StatusVariableRepository;
import com.bottino.monitoring.service.schneider.SchneiderService;
import com.bottino.monitoring.service.schneider.SchneiderSyncService;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

@Service
public class VariableService {

   @Autowired
   private StatusVariableRepository statusRepository;

   @Autowired
   private AnalogVariableRepository analogRepository;

   @Autowired
   private CommandVariableRepository commandRepository;

   @Autowired
   private SchneiderSyncService schneiderSyncService;

   @Autowired
   private SchneiderService schneiderService;

   // Status Variables
   public List<StatusVariable> getAllStatusVariables() {
      return statusRepository.findAll();
   }

   public StatusVariable saveStatusVariable(StatusVariable variable, String username) {
      StatusVariable saved = statusRepository.save(variable);

      // Sync with Schneider
      if (username != null) {
         schneiderSyncService.syncSingleVariable(saved.getName(), "status", username);
      }

      return statusRepository.findById(saved.getId()).orElse(saved);
   }

   public StatusVariable updateStatusVariable(StatusVariable variable, String username) {
      StatusVariable saved = statusRepository.save(variable);

      schneiderService.updateVariableValue(variable.getName(), variable.getValue(), "status",username);

      return statusRepository.findById(saved.getId()).orElse(saved);
   }

   public void deleteStatusVariable(Long id) {
      statusRepository.deleteById(id);
   }

   // Analog Variables
   public List<AnalogVariable> getAllAnalogVariables() {
      return analogRepository.findAll();
   }

   public AnalogVariable saveAnalogVariable(AnalogVariable variable, String username) {
      AnalogVariable saved = analogRepository.save(variable);

      // Sync with Schneider
      if (username != null) {
         schneiderSyncService.syncSingleVariable(saved.getName(), "analog", username);
      }

      return analogRepository.findById(saved.getId()).orElse(saved);
   }

   public AnalogVariable updateAnalogVariable(AnalogVariable variable, String username) {
      AnalogVariable saved = analogRepository.save(variable);

      schneiderService.updateVariableValue(variable.getName(), variable.getValue(), "analog", username);

      return analogRepository.findById(saved.getId()).orElse(saved);
   }

   public void deleteAnalogVariable(Long id) {
      analogRepository.deleteById(id);
   }

   // Command Variables
   public List<CommandVariable> getAllCommandVariables() {
      return commandRepository.findAll();
   }

   public CommandVariable saveCommandVariable(CommandVariable variable, String username) {
      CommandVariable saved = commandRepository.save(variable);

      // Sync with Schneider
      if (username != null) {
         schneiderSyncService.syncSingleVariable(saved.getName(), "command", username);
      }

      return commandRepository.findById(saved.getId()).orElse(saved);
   }

   public CommandVariable updateCommandVariable(CommandVariable variable, String username) {
      CommandVariable saved = commandRepository.save(variable);

      schneiderService.updateVariableValue(variable.getName(), variable.getValue(), "command", username);

      return commandRepository.findById(saved.getId()).orElse(saved);
   }

   public void deleteCommandVariable(Long id) {
      commandRepository.deleteById(id);
   }

   // CSV Import
   public int importStatusVariablesFromCSV(MultipartFile file, String username) throws Exception {
      return importCSV(file, "status", username);
   }

   public int importAnalogVariablesFromCSV(MultipartFile file, String username) throws Exception {
      return importCSV(file, "analog", username);
   }

   public int importCommandVariablesFromCSV(MultipartFile file, String username) throws Exception {
      return importCSV(file, "command", username);
   }

   private int importCSV(MultipartFile file, String type, String username) throws Exception {
      List<CSVRecord> records = parseCSV(file);
      int count = 0;

      for (CSVRecord record : records) {
         String name = record.get("name");
         String description = record.size() > 1 ? record.get("description") : "";
         String value = ""; // Empty value, will be filled by Schneider sync

         switch (type) {
            case "status":
               StatusVariable statusVar = new StatusVariable(null, name, value, description);
               statusRepository.save(statusVar);
               break;
            case "analog":
               AnalogVariable analogVar = new AnalogVariable(null, name, value, description);
               analogRepository.save(analogVar);
               break;
            case "command":
               CommandVariable commandVar = new CommandVariable(null, name, value, description);
               commandRepository.save(commandVar);
               break;
         }

         // Sync each variable with Schneider
         //            if (username != null) {
         //                schneiderSyncService.syncSingleVariable(name, type, username);
         //            }

         count++;
      }

      return count;
   }

   private List<CSVRecord> parseCSV(MultipartFile file) throws Exception {
      try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {

         CSVParser csvParser = new CSVParser(reader, CSVFormat.DEFAULT.withFirstRecordAsHeader().withIgnoreHeaderCase().withTrim());

         return csvParser.getRecords();
      }
   }
}
