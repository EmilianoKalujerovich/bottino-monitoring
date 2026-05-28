package com.bottino.monitoring.repository;

import com.bottino.monitoring.model.VariableHistoryConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface VariableHistoryConfigRepository extends JpaRepository<VariableHistoryConfig, Long> {

    Optional<VariableHistoryConfig> findByVariableIdAndVariableType(Long variableId, String variableType);

    List<VariableHistoryConfig> findBySaveHistoryTrueOrSaveMaxHistoryTrue();

    List<VariableHistoryConfig> findBySaveHistoryTrue();

    List<VariableHistoryConfig> findBySaveMaxHistoryTrue();
}
