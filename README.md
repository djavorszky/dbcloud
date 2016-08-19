# dbcloud
database server abstraction layer

# Components

## Services
### worker
Read queue, and executes commands

### app
Provides a front-end

### APIServer
Provides API

### logger
Log all of the services

### maint
Ensure consistency between the real database servers, and the internal meta-data (mongodb)

## Data Storage

### mongodb
Stores meta-data about the databases, and database servers

### redis
Stores session info, and acting as a back-end for the queue handler.

