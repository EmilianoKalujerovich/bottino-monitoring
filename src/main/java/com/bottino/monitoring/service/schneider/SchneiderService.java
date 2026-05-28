package com.bottino.monitoring.service.schneider;

import com.bottino.monitoring.dto.SchneiderVariable;
import com.bottino.monitoring.model.User;
import com.bottino.monitoring.repository.UserRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.StringReader;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.SocketException;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class SchneiderService {

   @Autowired
   private RestTemplate restTemplate;

   @Autowired
   private UserRepository userRepository;

   private Map<String, String> sessionCache = new HashMap<>();

   /**
    * Login to Schneider and get session ID
    */
   public String login(String username, String password, String rtuIp) {
      try {
         // Disable SSL verification
         TrustManager[] trustAllCerts = new TrustManager[] { new X509TrustManager() {

            public X509Certificate[] getAcceptedIssuers() {
               return null;
            }

            public void checkClientTrusted(X509Certificate[] certs, String authType) {
            }

            public void checkServerTrusted(X509Certificate[] certs, String authType) {
            }
         } };

         SSLContext sc = SSLContext.getInstance("TLSv1.2");
         sc.init(null, trustAllCerts, new SecureRandom());
         HttpsURLConnection.setDefaultSSLSocketFactory(sc.getSocketFactory());
         HttpsURLConnection.setDefaultHostnameVerifier((hostname, session) -> true);

         // Encode parameters
         String arg1 = Base64.getEncoder().encodeToString(username.getBytes(StandardCharsets.UTF_8));
         String arg2 = Base64.getEncoder().encodeToString(password.getBytes(StandardCharsets.UTF_8));
         String arg3 = Base64.getEncoder().encodeToString("TGAPPVERSION".getBytes(StandardCharsets.UTF_8));
         String cgiMethod = Base64.getEncoder().encodeToString("cgiLogin".getBytes(StandardCharsets.UTF_8));

         // URL-encode the values (CRITICAL!)
         String encodedArg1 = URLEncoder.encode(arg1, StandardCharsets.UTF_8);
         String encodedArg2 = URLEncoder.encode(arg2, StandardCharsets.UTF_8);
         String encodedArg3 = URLEncoder.encode(arg3, StandardCharsets.UTF_8);
         String encodedCgiMethod = URLEncoder.encode(cgiMethod, StandardCharsets.UTF_8);

         // Build body with URL-encoded values
         String body = "arg1=" + encodedArg1 + "&arg2=" + encodedArg2 + "&arg3=" + encodedArg3 + "&cgiMethod=" + encodedCgiMethod;

         System.out.println("Request body: " + body);

         URL url = new URL("https://" + rtuIp + "/cgi/json");
         HttpsURLConnection conn = (HttpsURLConnection) url.openConnection();

         conn.setRequestMethod("POST");
         conn.setDoOutput(true);
         conn.setConnectTimeout(10000);
         conn.setReadTimeout(30000);

         // Headers matching Postman
         conn.setRequestProperty("Host", rtuIp);
         conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
         conn.setRequestProperty("Accept", "application/json");
         conn.setRequestProperty("Content-Length", String.valueOf(body.getBytes(StandardCharsets.UTF_8).length));

         // Send request
         try (OutputStream os = conn.getOutputStream()) {
            os.write(body.getBytes(StandardCharsets.UTF_8));
            os.flush();
         }

         // Read response
         int responseCode = conn.getResponseCode();
         System.out.println("Response Code: " + responseCode);

         if (responseCode == 200) {
            // Read response body and check for login error
            String responseBody;
            try (BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
               StringBuilder sb = new StringBuilder();
               String line;
               while ((line = br.readLine()) != null) sb.append(line);
               responseBody = sb.toString();
            }
            System.out.println("Response: " + responseBody);

            if (responseBody.contains("\"status\":\"error\"")) {
               System.err.println("❌ Schneider login rejected — check credentials. RTU response: " + responseBody);
               conn.disconnect();
               return null;
            }

            // Extract session ID from cookies
            List<String> cookies = conn.getHeaderFields().get("Set-Cookie");
            if (cookies != null) {
               for (String cookie : cookies) {
                  System.out.println("Cookie: " + cookie);
                  if (cookie.startsWith("SESSIONID=")) {
                     String sessionId = cookie.split(";")[0].replace("SESSIONID=", "");
                     System.out.println("Session ID extracted: " + sessionId);
                     return sessionId;
                  }
               }
            }
         }

         conn.disconnect();
         return null;

      } catch (Exception e) {
         e.printStackTrace();
         return null;
      }
   }

   /**
    * Get session ID from cache or login. Empty strings are treated as invalid.
    */
   private String getSessionId(String rtuIp, String username, String password) {
      String sessionId = sessionCache.get(rtuIp);
      if (sessionId == null || sessionId.isEmpty()) {
         sessionId = freshLogin(rtuIp, username, password);
      }
      return sessionId;
   }

   /**
    * Force a new login, bypassing the cache.
    */
   private String freshLogin(String rtuIp, String username, String password) {
      sessionCache.remove(rtuIp);
      String sessionId = login(username, password, rtuIp);
      if (sessionId != null && !sessionId.isEmpty()) {
         sessionCache.put(rtuIp, sessionId);
         System.out.println("✅ New session cached for " + rtuIp);
      } else {
         System.err.println("❌ Login returned no session ID for " + rtuIp);
      }
      return (sessionId != null && !sessionId.isEmpty()) ? sessionId : null;
   }

   public void clearSessionCache(String rtuIp) {
      sessionCache.remove(rtuIp);
   }

   /**
    * Get variable names from XML endpoint
    */
   public List<SchneiderVariable> getVariableNames(String type, String rtuIp, String username, String password) {
      List<SchneiderVariable> variables = new ArrayList<>();

      try {
         String sessionId = getSessionId(rtuIp, username, password);
         if (sessionId == null) {
            return variables;
         }

         String endpoint = switch (type) {
            case "status" -> "/cfgFiles/db_status.xml";
            case "analog" -> "/cfgFiles/db_analog.xml";
            case "command" -> "/cfgFiles/db_command.xml";
            default -> null;
         };

         if (endpoint == null) {
            return variables;
         }

         String url = "https://" + rtuIp + endpoint;

         ResponseEntity<String> response = executeGetWithRetry(url, sessionId, rtuIp, username, password);

         if (response != null && response.getStatusCode() == HttpStatus.OK) {
            String xmlContent = cleanXmlContent(response.getBody());
            variables = parseXmlVariables(xmlContent, type);
         }

      } catch (Exception e) {
         System.err.println("Error getting variable names: " + e.getMessage());
      }

      return variables;
   }

   /**
    * Clean XML content
    */
   private String cleanXmlContent(String xmlContent) {
      // Remove UTF-8 BOM character if present (appears as  or ï»¿)
      if (xmlContent.startsWith("\uFEFF")) {
         xmlContent = xmlContent.substring(1);
         System.out.println("Removed UTF-8 BOM (\\uFEFF)");
      }

      // Also check for BOM that appears as literal characters ï»¿
      if (xmlContent.startsWith("ï»¿")) {
         xmlContent = xmlContent.substring(3);
         System.out.println("Removed visible BOM characters");
      }

      // Trim any whitespace
      xmlContent = xmlContent.trim();

      return xmlContent;
   }

   /**
    * Parse XML response to extract variable names
    */
   private List<SchneiderVariable> parseXmlVariables(String xmlContent, String type) {
      List<SchneiderVariable> variables = new ArrayList<>();

      try {
         // Remove BOM and trim whitespace
         xmlContent = xmlContent.trim();

         // Remove BOM if present (UTF-8 BOM is EF BB BF)
         if (xmlContent.startsWith("\uFEFF")) {
            xmlContent = xmlContent.substring(1);
         }

         // Remove any leading whitespace or newlines before <?xml
         xmlContent = xmlContent.replaceFirst("^[\\s\\n\\r]+", "");

         System.out.println("First 100 chars: " + xmlContent.substring(0, Math.min(100, xmlContent.length())));

         DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
         factory.setNamespaceAware(false);
         factory.setValidating(false);
         factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);

         DocumentBuilder builder = factory.newDocumentBuilder();

         // Parse XML string
         InputSource is = new InputSource(new StringReader(xmlContent));
         Document doc = builder.parse(is);
         doc.getDocumentElement().normalize();

         // Get the tag name based on type
         String tagName = switch (type) {
            case "status" -> "STATUS";
            case "analog" -> "ANALOG";
            case "command" -> "COMMAND";
            default -> null;
         };

         if (tagName == null) {
            return variables;
         }

         // Get all elements with the tag name
         NodeList nodeList = doc.getElementsByTagName(tagName);

         System.out.println("Found " + nodeList.getLength() + " " + tagName + " elements");

         for (int i = 0; i < nodeList.getLength(); i++) {
            Node node = nodeList.item(i);

            if (node.getNodeType() == Node.ELEMENT_NODE) {
               Element element = (Element) node;

               SchneiderVariable variable = new SchneiderVariable();

               // Get NAME attribute
               String name = element.getAttribute("NAME");
               variable.setName(name);

               // Get DESC attribute
               String desc = element.getAttribute("DESC");
               variable.setDescription(desc);

               // Get EXT value from DEST_COORD child element (if exists)
               NodeList destCoordList = element.getElementsByTagName("DEST_COORD");
               if (destCoordList.getLength() > 0) {
                  Element destCoord = (Element) destCoordList.item(0);
                  String ext = destCoord.getAttribute("EXT");
                  variable.setValue(ext);
               }

               variable.setExistsInSchneider(true);

               variables.add(variable);
            }
         }

      } catch (Exception e) {
         System.err.println("Error parsing XML: " + e.getMessage());
         e.printStackTrace();
      }

      return variables;
   }

   /**
    * Get variable values via SOAP
    */
   public Map<String, String> getVariableValues(List<String> variableNames, String type, String rtuIp, String username, String password) {
      Map<String, String> values = new HashMap<>();

      try {
         String sessionId = getSessionId(rtuIp, username, password);
         if (sessionId == null || variableNames.isEmpty()) {
            return values;
         }

         String url = "https://" + rtuIp + "/soapServ/";

         // Build input names string [VAR1][VAR2][VAR3]...
         StringBuilder inputNames = new StringBuilder();
         for (String name : variableNames) {
            inputNames.append("[").append(name).append("]");
         }

         String soapBody = String.format(
               "<?xml version=\"1.0\" encoding=\"utf-8\"?>" + "<soapenv:Envelope xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\">"
                     + "<soapenv:Body>" + "<coreDbReadMultDatas xmlns=\"urn:soapServ\">"
                     + "<coreDbReadMultDataArray soapenc:arrayType=\"coreDbRMD[1]\" xmlns:soapenc=\"http://schemas.xmlsoap.org/soap/encoding/\">"
                     + "<coreDbReadMultData>" + "<inputNames>%s</inputNames>" + "<inputType>%s</inputType>" + "<inputFormat></inputFormat>"
                     + "<inputNum>%d</inputNum>" + "</coreDbReadMultData>" + "</coreDbReadMultDataArray>" + "</coreDbReadMultDatas>"
                     + "</soapenv:Body>" + "</soapenv:Envelope>", inputNames.toString(), type, variableNames.size());

         ResponseEntity<String> response = executeSoapWithRetry(url, soapBody, sessionId, rtuIp, username, password);

         if (response != null && response.getStatusCode() == HttpStatus.OK) {
            values = parseSoapResponse(response.getBody(), variableNames);
         }

      } catch (Exception e) {
         System.err.println("Error getting variable values: " + e.getMessage());
      }

      return values;
   }

   private ResponseEntity<String> executeGetWithRetry(String url, String sessionId, String rtuIp, String username, String password) {
      HttpHeaders headers = new HttpHeaders();
      headers.add("Cookie", "SESSIONID=" + sessionId);
      HttpEntity<String> request = new HttpEntity<>(headers);
      try {
         return restTemplate.exchange(url, HttpMethod.GET, request, String.class);
      } catch (org.springframework.web.client.HttpClientErrorException.Unauthorized e) {
         System.out.println("⚠️ Got 401 on GET, re-authenticating...");
         String newSession = freshLogin(rtuIp, username, password);
         if (newSession == null) return null;
         HttpHeaders retryHeaders = new HttpHeaders();
         retryHeaders.add("Cookie", "SESSIONID=" + newSession);
         return restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(retryHeaders), String.class);
      }
   }

   private ResponseEntity<String> executeSoapWithRetry(String url, String soapBody, String sessionId, String rtuIp, String username, String password) {
      HttpHeaders headers = new HttpHeaders();
      headers.setContentType(MediaType.valueOf("text/xml; charset=UTF-8"));
      headers.setAccept(Arrays.asList(MediaType.APPLICATION_XML, MediaType.TEXT_XML));
      headers.add("SOAPAction", "urn:soapServ#coreDbReadMultDatas");
      headers.add("Cookie", "SESSIONID=" + sessionId);
      HttpEntity<String> request = new HttpEntity<>(soapBody, headers);
      try {
         return restTemplate.postForEntity(url, request, String.class);
      } catch (org.springframework.web.client.HttpClientErrorException.Unauthorized e) {
         System.out.println("⚠️ Got 401 on SOAP, re-authenticating...");
         String newSession = freshLogin(rtuIp, username, password);
         if (newSession == null) return null;
         HttpHeaders retryHeaders = new HttpHeaders();
         retryHeaders.setContentType(MediaType.valueOf("text/xml; charset=UTF-8"));
         retryHeaders.setAccept(Arrays.asList(MediaType.APPLICATION_XML, MediaType.TEXT_XML));
         retryHeaders.add("SOAPAction", "urn:soapServ#coreDbReadMultDatas");
         retryHeaders.add("Cookie", "SESSIONID=" + newSession);
         return restTemplate.postForEntity(url, new HttpEntity<>(soapBody, retryHeaders), String.class);
      }
   }

   /**
    * Parse SOAP response to extract values
    * Format: [value|flag][value|flag]...
    */
   private Map<String, String> parseSoapResponse(String soapXml, List<String> variableNames) {
      Map<String, String> values = new HashMap<>();

      try {
         // Extract <return> content
         Pattern pattern = Pattern.compile("<return>(.*?)</return>");
         Matcher matcher = pattern.matcher(soapXml);

         if (matcher.find()) {
            String returnContent = matcher.group(1);

            // Parse [value|flag] format
            Pattern valuePattern = Pattern.compile("\\[([^|]+)\\|[^\\]]+\\]");
            Matcher valueMatcher = valuePattern.matcher(returnContent);

            int index = 0;
            while (valueMatcher.find() && index < variableNames.size()) {
               String value = valueMatcher.group(1);
               values.put(variableNames.get(index), value);
               index++;
            }
         }

      } catch (Exception e) {
         System.err.println("Error parsing SOAP response: " + e.getMessage());
      }

      return values;
   }

   /**
    * Get all variables with values for a specific type
    */
   public List<SchneiderVariable> getAllVariablesWithValues(String type, String currentUsername) {
      try {
         Optional<User> userOpt = userRepository.findByUsername(currentUsername);
         if (userOpt.isEmpty() || !userOpt.get().getHasSchneiderConfig()) {
            return new ArrayList<>();
         }

         User user = userOpt.get();
         String rtuIp = user.getRtuIp();
         String schneiderUsername = user.getSchneiderUsername();
         String schneiderPassword = user.getSchneiderPassword();

         // Get variable names
         List<SchneiderVariable> variables = getVariableNames(type, rtuIp, schneiderUsername, schneiderPassword);

         if (variables.isEmpty()) {
            return variables;
         }

         // Get variable names list
         List<String> names = variables.stream().map(SchneiderVariable::getName).toList();

         // Get values — retry with a fresh session if the first attempt returns nothing
         Map<String, String> values = getVariableValues(names, type, rtuIp, schneiderUsername, schneiderPassword);
         if (values.isEmpty() && !names.isEmpty()) {
            System.out.println("⚠️  SOAP returned no values, clearing session cache and retrying...");
            clearSessionCache(rtuIp);
            values = getVariableValues(names, type, rtuIp, schneiderUsername, schneiderPassword);
         }

         // Merge values
         for (SchneiderVariable var : variables) {
            String value = values.get(var.getName());
            var.setValue(value != null ? value : "");
         }

         return variables;

      } catch (Exception e) {
         System.err.println("Error getting variables with values: " + e.getMessage());
         return new ArrayList<>();
      }
   }

   /**
    * Update variable value in Schneider via SOAP
    */
   public boolean updateVariableValue(String variableName, String value, String type, String username) {

      Optional<User> userOpt = userRepository.findByUsername(username);
      if (userOpt.isEmpty() || !userOpt.get().getHasSchneiderConfig()) {
         System.err.println("Failed to get user");
      }

      User user = userOpt.get();
      String rtuIp = user.getRtuIp();
      String schneiderUsername = user.getSchneiderUsername();
      String schneiderPassword = user.getSchneiderPassword();

      try {
         String sessionId = getSessionId(rtuIp, schneiderUsername, schneiderPassword);
         if (sessionId == null) {
            System.err.println("Failed to get session ID");
            return false;
         }

         String url = "https://" + rtuIp + "/soapServ/";

         String soapBody = String.format(
               "<?xml version=\"1.0\" encoding=\"utf-8\"?>" + "<soapenv:Envelope xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\">"
                     + "<soapenv:Body>" + "<coreDbKrunchData xmlns=\"urn:soapServ\">" + "<inputType>%s</inputType>" + "<inputName>%s</inputName>"
                     + "<value>%s</value>" + "</coreDbKrunchData>" + "</soapenv:Body>" + "</soapenv:Envelope>", type, variableName, value);

         HttpHeaders headers = new HttpHeaders();
         headers.setContentType(MediaType.valueOf("text/xml; charset=UTF-8"));
         headers.setAccept(Arrays.asList(MediaType.APPLICATION_XML, MediaType.TEXT_XML));
         headers.add("SOAPAction", "urn:soapServ#coreDbKrunchData");
         headers.add("Cookie", "SESSIONID=" + sessionId);

         HttpEntity<String> request = new HttpEntity<>(soapBody, headers);

         ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);

         if (response.getStatusCode() == HttpStatus.OK) {
            System.out.println("Variable updated successfully in Schneider: " + variableName + " = " + value);
            return true;
         } else {
            System.err.println("Failed to update variable. Status: " + response.getStatusCode());
            return false;
         }

      } catch (Exception e) {
         System.err.println("Error updating variable in Schneider: " + e.getMessage());
         e.printStackTrace();
         return false;
      }
   }
}
