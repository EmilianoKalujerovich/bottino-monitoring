package com.bottino.monitoring.repository;

import com.bottino.monitoring.model.AnalogVariable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AnalogVariableRepository extends JpaRepository<AnalogVariable, Long> {
}
