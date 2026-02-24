# Bottino Monitoring System

## 📋 Description
Standalone executable application with Spring Boot, embedded H2 database and web frontend. When executing the JAR file, it automatically opens the browser with the application.

## 🎯 Features
- ✅ Self-contained application in a single JAR file
- ✅ Embedded H2 database (persistent)
- ✅ Two-step authentication (username/password + optional token)
- ✅ Three variable types: Status, Analog, Command
- ✅ Full CRUD operations for each variable type
- ✅ Batch CSV import with template download
- ✅ Modern and responsive web interface
- ✅ Auto-opens in browser

## 🛠️ Technologies
- **Backend:** Spring Boot 3.2.1
- **Database:** H2 (embedded)
- **Frontend:** HTML5, CSS3, JavaScript
- **Build:** Maven
- **CSV Processing:** Apache Commons CSV

## 📦 Requirements
- Java 17 or higher
- Maven 3.6+ (only for compilation)

## 🚀 Compile the Project

```bash
# Navigate to project folder
cd proyecto-ejecutable

# Compile with Maven
mvn clean package

# JAR file will be generated at:
# target/bottino-monitoring.jar
```

## ▶️ Run the Application

### Option 1: Double click (Windows)
- Double-click on `bottino-monitoring.jar`
- Browser will open automatically

### Option 2: Command line
```bash
java -jar target/bottino-monitoring.jar
```

## 🔐 Access Credentials

### Demo Accounts:

**Account 1 (No token required):**
- Username: `admin`
- Password: `admin123`

**Account 2 (Token required):**
- Username: `bottino`
- Password: `bottino123`
- Token: `BOTTINO_SECRET_TOKEN_2024`

## 📊 Using the Application

### Login Process
1. **Step 1:** Enter username and password
2. **Step 2:** If user has token enabled, enter security token
3. **Access:** You're in!

### Variable Management
The system has 3 tabs for different variable types:

#### 1. Status Variables
- For status indicators (RUNNING, STOPPED, ONLINE, etc.)
- Example: PUMP_STATUS, SYSTEM_STATUS

#### 2. Analog Variables
- For numeric/analog values
- Example: TEMPERATURE, PRESSURE, FLOW_RATE

#### 3. Command Variables
- For commands or actions
- Example: START_PUMP, STOP_PUMP, RESET_ALARM

### Operations Available:
- **New Variable:** Manual creation
- **Batch Import:** Upload CSV file with multiple variables
- **Edit:** Modify existing variable
- **Delete:** Remove variable
- **Refresh:** Reload data

### Batch Import (CSV)
1. Click "Batch Import" on any tab
2. Download the CSV template
3. Fill the template with your variables:
   ```csv
   name,value,description
   VARIABLE_1,100,Description 1
   VARIABLE_2,Active,Description 2
   ```
4. Upload the file
5. Variables are automatically imported

## 🗂️ Project Structure

```
proyecto-ejecutable/
├── src/
│   └── main/
│       ├── java/com/bottino/monitoring/
│       │   ├── Application.java
│       │   ├── config/
│       │   │   └── DataInitializer.java
│       │   ├── controller/
│       │   │   ├── AuthController.java
│       │   │   └── VariableController.java
│       │   ├── dto/
│       │   │   ├── LoginRequest.java
│       │   │   ├── LoginResponse.java
│       │   │   └── TokenValidationRequest.java
│       │   ├── model/
│       │   │   ├── User.java
│       │   │   ├── StatusVariable.java
│       │   │   ├── AnalogVariable.java
│       │   │   └── CommandVariable.java
│       │   ├── repository/
│       │   │   ├── UserRepository.java
│       │   │   ├── StatusVariableRepository.java
│       │   │   ├── AnalogVariableRepository.java
│       │   │   └── CommandVariableRepository.java
│       │   └── service/
│       │       ├── AuthService.java
│       │       └── VariableService.java
│       └── resources/
│           ├── static/
│           │   ├── index.html
│           │   ├── template.csv
│           │   ├── css/styles.css
│           │   └── js/app.js
│           └── application.properties
└── pom.xml
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/login` - Login with username/password
- `POST /api/auth/validate-token` - Validate security token

### Status Variables
- `GET /api/variables/status` - List all
- `POST /api/variables/status` - Create new
- `PUT /api/variables/status/{id}` - Update
- `DELETE /api/variables/status/{id}` - Delete
- `POST /api/variables/status/import-csv` - Batch import

### Analog Variables
- `GET /api/variables/analog` - List all
- `POST /api/variables/analog` - Create new
- `PUT /api/variables/analog/{id}` - Update
- `DELETE /api/variables/analog/{id}` - Delete
- `POST /api/variables/analog/import-csv` - Batch import

### Command Variables
- `GET /api/variables/command` - List all
- `POST /api/variables/command` - Create new
- `PUT /api/variables/command/{id}` - Update
- `DELETE /api/variables/command/{id}` - Delete
- `POST /api/variables/command/import-csv` - Batch import

## 💾 Database

Database automatically created at:
```
./data/bottino-monitoring.mv.db
```

### Initial Demo Data
- 2 demo users (admin, bottino)
- 3 status variables
- 3 analog variables
- 3 command variables

### H2 Console (Optional)
Access at: http://localhost:8080/h2-console

**Credentials:**
- JDBC URL: `jdbc:h2:file:./data/bottino-monitoring`
- User: `sa`
- Password: (empty)

## 🎨 Customization

### Change port
In `application.properties`:
```properties
server.port=9090
```

### Add new user
Edit `DataInitializer.java` or use H2 console

### Modify demo data
Edit `DataInitializer.java`

## 📝 Important Notes

1. **Java Required:** Client needs Java 17+ installed
2. **Persistence:** Data saved in `./data/bottino-monitoring.mv.db`
3. **Port:** Default port is 8080
4. **Session:** Session token stored in browser localStorage

## 📧 Distribution

To deliver to client:
1. Compile: `mvn clean package`
2. Deliver: `target/bottino-monitoring.jar`
3. Include: Java 17+ installation instructions

---

**Developed with ❤️ using Spring Boot**
