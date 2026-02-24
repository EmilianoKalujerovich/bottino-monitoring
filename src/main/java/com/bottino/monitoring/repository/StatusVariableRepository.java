package com.bottino.monitoring.repository;

import com.bottino.monitoring.model.StatusVariable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface StatusVariableRepository extends JpaRepository<StatusVariable, Long> {
}
