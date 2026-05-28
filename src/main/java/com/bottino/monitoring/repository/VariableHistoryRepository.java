package com.bottino.monitoring.repository;

import com.bottino.monitoring.model.VariableHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface VariableHistoryRepository extends JpaRepository<VariableHistory, Long> {

    List<VariableHistory> findByVariableIdAndVariableTypeOrderByRecordedAtAsc(Long variableId, String variableType);

    List<VariableHistory> findByVariableIdAndVariableTypeAndIsMaxTrackingOrderByRecordedAtAsc(
            Long variableId, String variableType, Boolean isMaxTracking);

    @Query("SELECT vh FROM VariableHistory vh WHERE vh.variableId = :variableId " +
           "AND vh.variableType = :variableType " +
           "AND vh.recordedAt >= :from ORDER BY vh.recordedAt ASC")
    List<VariableHistory> findByVariableIdAndTypeAndDateRange(
            @Param("variableId") Long variableId,
            @Param("variableType") String variableType,
            @Param("from") LocalDateTime from);

    void deleteByVariableIdAndVariableType(Long variableId, String variableType);
}
