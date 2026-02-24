package com.bottino.monitoring.repository;

import com.bottino.monitoring.model.CommandVariable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CommandVariableRepository extends JpaRepository<CommandVariable, Long> {
}
