/*

HOSTING: 
npm install http-server -g
npm i sqlite3
http-server E:\BHASVIC\Year_2\Computer_Science\Main_Project\Client-Side -p 80
http-server /Volumes/THE-BIG-ONE/BHASVIC/Year_2/Computer_Science/Main_Project/Client-Side -p 80
This is the main NodeJS file, managing the websockets to the clients, and therefore the games, the chat and the logging in

Main features:
 - The ability to sign up
 - The ability to login as a guest

TODO:
this.getChosenCardsToSend(player) bit funny does a null per user...

*/

var http = require('http');
var striptags = require('striptags');
const WebSocket = require('ws');
var sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const Container = require("./container.js");
var fs = require('fs'); 
var db = new sqlite3.Database(':memory:');
//var db = new sqlite3.Database('userDatabase.db');

createDatabase();
const wss = new WebSocket.Server({ port: 8081 }); // Initiates the websocket and sets the port to 8080
var container = new Container(wss, db); // initiates the container, this hosts the game, the WebSocketServer server and the DataBase are passed on when it is initialised


function createDatabase(){ // This creates a fresh database everytime the game is restarted
    db.serialize(() => {
      // *********** Creating the database structure ***********
      db.run("CREATE TABLE User (userID INTEGER PRIMARY KEY AUTOINCREMENT, username varchar(20), password varchar(64), email varchar(60), joinedAt INTEGER, admin BOOLEAN DEAFULT false)");
      db.run("CREATE TABLE Game_History (ID INTEGER PRIMARY KEY AUTOINCREMENT, userID INTEGER, time INTEGER, score INTEGER, FOREIGN KEY(userID) REFERENCES User(userID))");
      db.run("CREATE TABLE Deck (deckID INTEGER PRIMARY KEY AUTOINCREMENT, name varchar(20), userID INTEGER, time INTEGER, public BOOLEAN, FOREIGN KEY(userID) REFERENCES User(userID))");
      db.run("CREATE TABLE Card (cardID INTEGER PRIMARY KEY AUTOINCREMENT, deckID INTEGER, cardType BOOLEAN, cardText varchar(120), cardsToPick INTEGER, FOREIGN KEY(deckID) REFERENCES Deck(deckID))");
      
      // *********** Inserting the test data ***********
      db.exec("INSERT INTO User (username, password, email, joinedAt) VALUES ('coolKid', 'd0c6945e8be5220078ed7caf38292c3f43558ffe530e3e75e0c6b5f9a2fb067b', 'mrcool@dank.com', 456345345444)");
      db.exec("INSERT INTO User (username, password, email, joinedAt) VALUES ('coolKid1', 'd0c6945e8be5220078ed7caf38292c3f43558ffe530e3e75e0c6b5f9a2fb067b', 'mrcool@dank1.com', 456345345444)");
      db.exec("INSERT INTO Game_History (userID, time, score) VALUES (1, 1570284327, 11)");
      db.exec("INSERT INTO Deck (userID, time, name, public) VALUES (1, 1570284327, 'The Best Deck', true)");
      db.exec("INSERT INTO Card (deckID, cardType, cardText, cardsToPick) VALUES (1, false, 'Elon Musk went to the hospital with ______ stuck up _____', 2)");
      db.exec("INSERT INTO Card (deckID, cardType, cardText, cardsToPick) VALUES (1, true, 'A Falcon Rocket', 0)");
      db.exec("INSERT INTO Card (deckID, cardType, cardText, cardsToPick) VALUES (1, true, 'Harvey Winestein', 0)");
      
      fs.readFile('cards.json', function(err, data) {// this opens the cards.json file and returns the contents as "data"
        if(err) return console.log(`Error reading file: ${err}`);
        var cards = JSON.parse(data); // parses the JSON into a JS object
        db.run("INSERT INTO Deck (userID, time, name, public) VALUES (1, 1570359538858, 'tech support deck', true)", (err) => { // This creates the deck in the deck table
          if(err) return console.log(`Error creating deck: ${err}`);
        });
        
        // below inserts the cards into the card table, linking it to the first DB 
        cards["white cards"].forEach(text => {
          db.run("INSERT INTO Card (deckID, cardType, cardsToPick, cardText) VALUES (2, true, 0, ?)", [text], (err) => {
            if(err) return console.log(`Error inserting card into datbase: ${err}`);
          });
        });
        cards["black cards"].forEach(obj => {
          db.run("INSERT INTO Card (deckID, cardType, cardsToPick, cardText) VALUES (2, false, ?, ?)", [obj.cards, obj.text], (err) => {
            if(err) return console.log(`Error inserting card into datbase: ${err}`);
          });
        });
      });

      fs.readFile('json-against-humanity/dev/cah.json', function(err, data) {// this opens the cards.json file and returns the contents as "data"
        if(err) return console.log(`Error reading file: ${err}`);
        var cards = JSON.parse(data);

        db.run("INSERT INTO Deck (userID, time, name, public) VALUES (1, 1570359538858, 'lots of decks', true)", (err) => { // This creates the deck in the deck table
          if(err) return console.log(`Error creating deck: ${err}`);
        });
        
        cards["blackCards"].forEach(card => {
          if(card.text.length > 100) return; // removes all the really long question cards
          if(card.text.split(" ").find(word => word.length > 20)) return;
          db.run("INSERT INTO Card (deckID, cardType, cardsToPick, cardText) VALUES (3, false, ?, ?)", [card.pick, striptags(card.text)], (err) => {
            if(err) return console.log(`Error inserting card into datbase: ${err}`);
          });
        });

        cards["whiteCards"].forEach(text => {
          if(text.length > 100) return;
          if(text.split(" ").find(word => word.length > 20)) return;
          db.run("INSERT INTO Card (deckID, cardType, cardsToPick, cardText) VALUES (3, true, 0, ?)", [striptags(text)], (err) => {
            if(err) return console.log(`Error inserting card into datbase: ${err}`);
          });
        });
      });
    });
  } // This function is to make the database and insert test data

/* Test Data 
Login: {"action": "login", "username": "coolKid69", "password":"yeet"}
Register: {"action": "register", "username": "yeetasaurusrex", "password": "ayup", "email": "yeet@gmail.com"}
*/

/*
wss.on('connection', function connection(ws) {
    gameObject.users += new User(ws);// new 
    console.log(`new websocket connection! Total Connected: ${gameObject.users.length}`);

});
*/