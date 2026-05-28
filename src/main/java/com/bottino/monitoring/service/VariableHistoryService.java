package com.bottino.monitoring.service;

import com.bottino.monitoring.model.VariableHistory;
import com.bottino.monitoring.model.VariableHistoryConfig;
import com.bottino.monitoring.repository.VariableHistoryConfigRepository;
import com.bottino.monitoring.repository.VariableHistoryRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class VariableHistoryService {

    @Autowired
    private VariableHistoryRepository historyRepository;

    @Autowired
    private VariableHistoryConfigRepository configRepository;

    // ---- Config management ----

    public VariableHistoryConfig getOrCreateConfig(Long variableId, String variableType) {
        return configRepository.findByVariableIdAndVariableType(variableId, variableType)
                .orElseGet(() -> {
                    VariableHistoryConfig cfg = new VariableHistoryConfig();
                    cfg.setVariableId(variableId);
                    cfg.setVariableType(variableType);
                    cfg.setSaveHistory(false);
                    cfg.setSaveMaxHistory(false);
                    cfg.setCreatedAt(LocalDateTime.now());
                    return configRepository.save(cfg);
                });
    }

    public VariableHistoryConfig enableHistory(Long variableId, String variableType) {
        VariableHistoryConfig cfg = getOrCreateConfig(variableId, variableType);
        cfg.setSaveHistory(true);
        return configRepository.save(cfg);
    }

    public VariableHistoryConfig enableMaxHistory(Long variableId, String variableType) {
        VariableHistoryConfig cfg = getOrCreateConfig(variableId, variableType);
        cfg.setSaveMaxHistory(true);
        return configRepository.save(cfg);
    }

    public VariableHistoryConfig disableHistory(Long variableId, String variableType) {
        VariableHistoryConfig cfg = getOrCreateConfig(variableId, variableType);
        cfg.setSaveHistory(false);
        return configRepository.save(cfg);
    }

    public VariableHistoryConfig disableMaxHistory(Long variableId, String variableType) {
        VariableHistoryConfig cfg = getOrCreateConfig(variableId, variableType);
        cfg.setSaveMaxHistory(false);
        return configRepository.save(cfg);
    }

    public Map<String, Object> getConfigStatus(Long variableId, String variableType) {
        Optional<VariableHistoryConfig> opt = configRepository.findByVariableIdAndVariableType(variableId, variableType);
        Map<String, Object> result = new HashMap<>();
        if (opt.isPresent()) {
            result.put("saveHistory", opt.get().getSaveHistory());
            result.put("saveMaxHistory", opt.get().getSaveMaxHistory());
        } else {
            result.put("saveHistory", false);
            result.put("saveMaxHistory", false);
        }
        return result;
    }

    // ---- History recording (called from sync service) ----

    public void recordValueIfEnabled(Long variableId, String variableType, String variableName, String value) {
        Optional<VariableHistoryConfig> opt = configRepository.findByVariableIdAndVariableType(variableId, variableType);
        if (opt.isEmpty()) return;

        VariableHistoryConfig cfg = opt.get();

        // Record normal history
        if (Boolean.TRUE.equals(cfg.getSaveHistory())) {
            VariableHistory history = new VariableHistory();
            history.setVariableId(variableId);
            history.setVariableType(variableType);
            history.setVariableName(variableName);
            history.setValue(value);
            history.setRecordedAt(LocalDateTime.now());
            history.setIsMaxTracking(false);
            historyRepository.save(history);
        }

        // Record max history - only saves if current value is numeric and >= stored max
        if (Boolean.TRUE.equals(cfg.getSaveMaxHistory())) {
            try {
                double currentVal = Double.parseDouble(value);

                // Get the last recorded max
                List<VariableHistory> maxRecords = historyRepository
                        .findByVariableIdAndVariableTypeAndIsMaxTrackingOrderByRecordedAtAsc(
                                variableId, variableType, true);

                double lastMax = maxRecords.isEmpty()
                        ? Double.MIN_VALUE
                        : Double.parseDouble(maxRecords.get(maxRecords.size() - 1).getValue());

                if (currentVal >= lastMax) {
                    VariableHistory maxHistory = new VariableHistory();
                    maxHistory.setVariableId(variableId);
                    maxHistory.setVariableType(variableType);
                    maxHistory.setVariableName(variableName);
                    maxHistory.setValue(value);
                    maxHistory.setRecordedAt(LocalDateTime.now());
                    maxHistory.setIsMaxTracking(true);
                    historyRepository.save(maxHistory);
                }
            } catch (NumberFormatException e) {
                // Non-numeric value, still save it for max tracking
                VariableHistory maxHistory = new VariableHistory();
                maxHistory.setVariableId(variableId);
                maxHistory.setVariableType(variableType);
                maxHistory.setVariableName(variableName);
                maxHistory.setValue(value);
                maxHistory.setRecordedAt(LocalDateTime.now());
                maxHistory.setIsMaxTracking(true);
                historyRepository.save(maxHistory);
            }
        }
    }

    // ---- Retrieving history ----

    public List<VariableHistory> getHistory(Long variableId, String variableType) {
        return historyRepository.findByVariableIdAndVariableTypeAndIsMaxTrackingOrderByRecordedAtAsc(
                variableId, variableType, false);
    }

    public List<VariableHistory> getMaxHistory(Long variableId, String variableType) {
        return historyRepository.findByVariableIdAndVariableTypeAndIsMaxTrackingOrderByRecordedAtAsc(
                variableId, variableType, true);
    }
}
