const User = require('./user.js');
const Game = require('./game.js');

module.exports = class Container {
    constructor(wss, db){
        // *********** initialising the attributes ***********
        this.db = db;
        this.users = [];
        this.guests = 0;
        this.disconnectedUsers = [];
        this.games = [];
        this.publicDecks = [];
        this.updatePublicDecks();
        // *********** Websocket management ***********
        wss.on('connection', (ws) => { // Whenever there is a new connection, a new user is created
            this.users.push(new User(ws, this));
            console.log(`new websocket connection! Total Connected: ${this.users.length}`);
        });
        wss.on('error', (err) => { // whenever there is an error, it is logged to the console
            console.log(`Websocket Error: ${err}`);
        });
    }
    getGames(){ // This is to get the games to send to the user
        return this.games.map(game => {return {"name": game.getGameName(), "players": game.players.length, "host": game.host.username, "private": game.private, "rounds": game.rounds, "round": game.round, "joinable": game.joinable, "decks added": game.getDecksAdded(), "status": game.status}});
    }
    getGuestUsername(){
        this.guests++;
        var username = `Guest ${this.guests}`;
        return username;
    }
    createNewGame(user, name, password){
        name = name.replace(/['"\t\n\r]+/g, '').replace(/\s/g, "-");
        user.returnMessage("done", true, "game created");
        this.games.push(new Game(user, this, name, password));
        this.sendGamesUpdate(); // This sends the updated games array to the people on the home page
    }
    sendDecksAvailable(user){
        this.db.all("SELECT * FROM Deck WHERE public = true OR userID = ?", [user.userID], (err, rows) => {
            if(err) return console.log(`Error with get decks SQL query: ${err}`);
            this.db.serialize(() => {
                let deckArray = [];
                let decksToGo = rows.length;
                for(var i=0;i<rows.length;i++){
                    let deck = rows[i];
                    this.db.all("SELECT * FROM Card WHERE deckID = ?", deck.deckID, (err, rows) => {
                        if(err) return console.log(`Error with get decks SQL query: ${err}`);
                        let whiteCardCount = rows.filter(card => card.cardType).length;
                        let blackCardCount = rows.length-whiteCardCount;
                        deckArray.push({"name": deck.name, "deckID": deck.deckID, "white card count": whiteCardCount, "black card count": blackCardCount, "private": deck.private});
                        if(deckArray.length == decksToGo) {
                            user.returnMessage("update", true, {"decks available": deckArray});
                        } 
                    });
                }
            });
        });
    }
    removeUser(user){
        user.username.length > 0 ? console.log(`User Removed, username: ${user.username}`) : console.log(`User Removed`);
        let userGame = user.getGame();
        if(userGame){
            if(userGame.players.length < 2){
                this.removeGame(userGame);
            } else {
                if(userGame.host == user){
                    userGame.setHost(userGame.players[1].user);
                }
                userGame.removePlayer(userGame.players.find(player => player.user == user)); // if the user is in a game, remove them
            }
        }
        if(user.ws.readyState == 1){
            user.ws.close(); // closes the websocket if it's open
        }
        this.users = this.users.filter(value => value != user); // finally filters the users array in the container to remove the user that has left
    }
    getUserCount(){ // this is for getting the users in game for the sign in page so users can easily see how many people there are
        let count = 0;
        this.users.forEach((user) => {
            if(user.getSignedIn()) count++;
        });
        return count;
    }
    getGamesCount(){ // like the getUserCount function, this is for showing the user on the login page how many games are running
        return this.games.length;
    }
    printDatabase(){ // this function is for debugging and finding errors in the database, it prints all the tables
        this.db.each("SELECT * FROM User", function(err, row) {
            console.log(`ID: ${row.userID} : Username: ${row.username}, Password (hash): ${row.password}, Email: ${row.email}`);
          });
          this.db.each("SELECT * FROM Game_History", function(err, row) {
            console.log(`ID: ${row.ID} : userID: ${row.userID}, Time Played: ${row.time}, Score: ${row.score}`);
          });
          this.db.each("SELECT * FROM Deck", function(err, row) {
            console.log(`ID: ${row.userID} : Time Added: ${row.time}, Name: ${row.name}, Public: ${row.public ? "Yes" : "No"}`);
          });
          this.db.each("SELECT * FROM Card ORDER BY cardType", function(err, row) {
            console.log(`ID: ${row.deckID} : Type: ${row.cardType ? "White" : "Black"}, Text: ${row.cardText}, Cards To Pick: ${row.cardsToPick}`);
          });
    }
    incomingRequest(user, data){ // this function handles whenever the user requests on the websocket, its for creating games mainly
        if(data.request == "create game"){
            if(!user.signedIn) return user.returnMessage("error", true, "cant create game when user is not signed in");
            if(!data["game name"]) user.returnMessage("error", true, "no game name");
            data["game name"] = data["game name"].trim();
            if(!(data["game name"].length > 5 && data["game name"].length < 25)) return user.returnMessage("error", true, "invalid game name length");
            if(user.getGame()) return user.returnMessage("error", true, "user already in game");
            if(this.games.find(game => game.gameName == data["game name"])) return user.returnMessage("error", false, "A Game With That Name Already Exists!");
            if(data.password){
                if(data.password.length > 30 || data.password.length < 3) return user.returnMessage("error", true, "invalid request, password lenght not within range");
                this.createNewGame(user, data["game name"], data.password);
            } else {
                this.createNewGame(user, data["game name"]);
            }
            
        } else if(data.request == "***PLACEHOLDER***"){

        } else {
            return user.returnMessage("error", true, "invalid request");
        }
    }
    removeGame(game){ // this just removes the game that is passed
        game.players.forEach((player) => { // this sends a message "game ended" 
            player.user.returnMessage("update", true, "Game ended");
        });
        clearTimeout(game.nextRoundTimeout);
        console.log(`Game ended, name: ${game.gameName}`);
        this.games = this.games.filter(value => value != game); // removes the game from the games array
        this.sendGamesUpdate(); // sends the users the games information for the home screen
    }
    sendGamesUpdate(){
        this.users.forEach((user) => {
            if(user.signedIn && !user.getGame()){ // if they're on the home screen
                user.returnMessage("update", true, {"games running": this.getGames()});
            }
        });
    }
    addUser(ws){
        
    } // not sure about this one
    userDisconnected(user){
        
    }
    getPublicDecks(){ // depreciated
        this.db.all("SELECT * FROM Deck WHERE public = true", (err, rows) => {
            if(err) return console.log(`Error with get decks SQL query: ${err}`);
            rows;
        });
    }
    updatePublicDecks(){ // Depreciated
        this.db.all("SELECT * FROM Deck WHERE public = true", (err, rows) => {
            if(err) return console.log(`Error with get decks SQL query: ${err}`);
            this.publicDecks = [];
            rows.forEach((deck) => {
                this.db.all("SELECT * FROM Card WHERE deckID = ?", deck.deckID, (err, rows) => {
                    if(err) return console.log(`Error with get decks SQL query: ${err}`);
                    let whiteCardCount = rows.filter(card => card.cardType).length;
                    let blackCardCount = rows.length-whiteCardCount;
                    this.publicDecks.push({"name": deck.name, "deckID": deck.deckID, "white card count": whiteCardCount, "black card count": blackCardCount, "private": false});
                });
            });
        });
    }
}