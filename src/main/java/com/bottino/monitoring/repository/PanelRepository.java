package com.bottino.monitoring.repository;

import com.bottino.monitoring.model.Panel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PanelRepository extends JpaRepository<Panel, Long> {
    List<Panel> findByUsername(String username);
}
