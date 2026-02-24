package com.bottino.monitoring;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.awt.Desktop;
import java.net.URI;

@SpringBootApplication
@EnableScheduling
public class Application {

   public static void main(String[] args) {
      SpringApplication.run(Application.class, args);
   }

   @EventListener(ApplicationReadyEvent.class)
   public void openBrowserAutomatically() {
      String url = "http://localhost:8080";
      System.out.println("==============================================");
      System.out.println("Bottino Monitoring System started successfully!");
      System.out.println("Opening browser at: " + url);
      System.out.println("==============================================");

      try {
         if (Desktop.isDesktopSupported() && Desktop.getDesktop().isSupported(Desktop.Action.BROWSE)) {
            Desktop.getDesktop().browse(new URI(url));
         } else {
            // Backup for macOS terminal users
            String os = System.getProperty("os.name").toLowerCase();
            if (os.contains("mac")) {
               Runtime.getRuntime().exec("open " + url);
            } else {
               System.out.println("Could not open browser automatically.");
               System.out.println("Please open manually: " + url);
            }
         }
      } catch (Exception e) {
         // If even the exec command fails
         System.err.println("Error opening browser: " + e.getMessage());
         System.out.println("Please open manually: " + url);
      }
   }
}
