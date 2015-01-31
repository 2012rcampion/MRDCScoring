JSDCServerV2
============

Scoring system for the Jerry Sanders Design Competition, version 2.

# Installation #

After installing [node](http://nodejs.org/), run

    npm install

Make sure that [MongoDB](https://www.mongodb.org/) is running.  Optionally use
`mongorestore` to load the database from one of the database dumps.

# Usage #

Run the application system using the command:

    node app.js

# Organization #

## Code ##

The main server routines are in `app.js`.  Database handling subroutines are located in `mongo.js`.

The ui pages are under `views/`, and are rendered with jade.

Database dumps are under `dump/`.

Configuration files are not implemented yet.

## Webserver ##

Front-facing user interface pages are located under the root.  For example, the
page for editing the teams ~~is~~ will be located under `/teams`.

Corresponding api calls will be under `/api`, e.g. `/api/teams`
