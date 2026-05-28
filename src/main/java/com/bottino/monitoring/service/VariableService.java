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
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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

         count++;
      }

      // Sync all saved variables with Schneider in one pass
      if (count > 0 && username != null) {
         schneiderSyncService.syncAllVariablesForType(type, username);
      }

      return count;
   }

   private List<CSVRecord> parseCSV(MultipartFile file) throws Exception {
      try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {

         CSVParser csvParser = new CSVParser(reader, CSVFormat.DEFAULT.withFirstRecordAsHeader().withIgnoreHeaderCase().withTrim());

         return csvParser.getRecords();
      }
   }

   // Excel (.xlsx) Import — reads Status, Analog and Command sheets in one go.
   // Sheet layout: row 0 = group header, row 1 = column headers, data from row 2.
   // Column A = NAME, column B = DESCRIPTION. Other sheets (Bin, SetPoint) are ignored.
   public Map<String, Integer> importAllVariablesFromExcel(MultipartFile file, String username) throws Exception {
      Map<String, Integer> counts = new HashMap<>();
      counts.put("status", 0);
      counts.put("analog", 0);
      counts.put("command", 0);

      DataFormatter fmt = new DataFormatter();

      try (Workbook wb = new XSSFWorkbook(file.getInputStream())) {
         String[] sheetNames = { "Status", "Analog", "Command" };

         for (String sheetName : sheetNames) {
            Sheet sheet = wb.getSheet(sheetName);
            if (sheet == null) continue;

            String type = sheetName.toLowerCase();
            int c = 0;

            for (int i = 2; i <= sheet.getLastRowNum(); i++) {
               Row row = sheet.getRow(i);
               if (row == null) continue;

               String name = readCell(row.getCell(0), fmt);
               if (name == null || name.isBlank()) continue;

               String description = readCell(row.getCell(1), fmt);
               String value = ""; // filled later by Schneider sync

               switch (type) {
                  case "status":
                     statusRepository.save(new StatusVariable(null, name, value, description));
                     break;
                  case "analog":
                     analogRepository.save(new AnalogVariable(null, name, value, description));
                     break;
                  case "command":
                     commandRepository.save(new CommandVariable(null, name, value, description));
                     break;
               }
               c++;
            }

            counts.put(type, c);
         }
      }

      // Sync each imported type with Schneider
      if (username != null) {
         for (String sheetName : new String[] { "status", "analog", "command" }) {
            if (counts.getOrDefault(sheetName, 0) > 0) {
               schneiderSyncService.syncAllVariablesForType(sheetName, username);
            }
         }
      }

      return counts;
   }

   private String readCell(Cell cell, DataFormatter fmt) {
      if (cell == null) return "";
      String v = fmt.formatCellValue(cell);
      return v == null ? "" : v.trim();
   }
}
