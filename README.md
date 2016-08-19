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

# Core functions

## Create a new, empty database
Creates a new database in a given database server. It has defaults, to have as few mandatory parameters as possible, to ease "trying it out".

## Delete a database

## Display settings for using the database
Liferay and Liferay DXP is supported, it prints out the database-related portal-ext.properties settings.

## Import a dump file
Import dumps to a given server, recognizes some compressed formats (zip, bzip2, gzip, 7z, ...)

## Clone database
Creates a clone from the database. It can be used to move database across different servers. It works by piping mysqldump output to the mysql command.

