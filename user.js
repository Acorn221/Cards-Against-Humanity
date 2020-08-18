const crypto = require('crypto');

module.exports = class User {
    constructor(ws, container){
        // Score, cards, lastDataSent and other game specific data needs to be put in game class, shouldn't be here
        this.ws = ws; // maybe .clone()?
        this.container = container;
        this.signedIn = false;
        this.inGame = false;
        this.username = "";
        this.privateDecks = [];
        this.email = "";
        this.userID = -1;
        this.admin = false;
        this.ws.on('message', (message) => { // handles the incoming WS messages
            this.processIncomingMessage(message);
        });
        this.ws.on('close', () => { // whenever a users websocket disconnects, they get removed from the game
            this.container.removeUser(this);
        });
        // this sends the amount of games running and players in game to the user, so it can be displayed on the login page
        this.returnMessage("update", true, {"users online": this.container.getGamesCount(), "games running": this.container.getGamesCount()});
    }
    signInAsGuest(){
        this.signedIn = true;
        this.username = this.container.getGuestUsername();
        return this.returnMessage("update", true, {"logged in": true, "games running": this.container.getGames(), "username": this.username});
    }
    login(username, password){
        if(this.signedIn) return this.returnMessage("error", true, "already signed in");
        if(!username || !password) return this.returnMessage("error", true, "missing varible");
        if(username.length <= 5 || username.length >= 20) return this.returnMessage("error", true, "invalid username");
        this.container.db.get("SELECT * FROM User WHERE username = ? COLLATE NOCASE", [username], (err, row) => { // searches for the user with the given username, not sensitive to caps
            if(err) return console.log(`Error with user class, login: ${err.message}`);
            // checks to see if the user is already signed in
            if(this.container.users.find(user => user.username == username)) return this.returnMessage("error", false, "User Already Signed In!");
            // If no row is found, no user has that username
            if(!row) return this.returnMessage("error", false, "No User Has This Username");
            // if the given hashed password is not the same as the hashed database password
            if(crypto.createHmac('sha256', password).digest('hex') != row.password) return this.returnMessage("error", false, "Incorrect Password");
            // sets the attributes
            this.username = username;
            this.signedIn = true;
            this.email = row.email;
            this.userID = row.userID;
            this.admin = row.admin;
            // need to send games running and basic stats about them            
            return this.returnMessage("update", true, {"logged in": true, "games running": this.container.getGames()});
        });
    }
    logOut(){
        if(this.signedIn){ // checks to see if the user is signed in
            // sets all the varibles to not logged in
            this.signedIn = false;
            this.username = "";
            this.email = "";
            this.privateDecks = [];
            this.userID = -1;
            this.admin = false;
            return this.returnMessage("done", true, "logged out");
        } else { // if they're not signed in, give back an error (used mainly for debugging)
            return this.returnMessage("error", true, "user not signed in");
        }
    }
    register(username, password, email){
        if(!username || !password || !email) return this.returnMessage("error", true, "missing var"); // checks to see if all varibles are there
        // checks to see if the given varibles are valid
        // these are already checked at the client side level, however, anything sent from the client can be anything they want it to be so it cant be trusted
        if(this.signedIn) return this.returnMessage("error", true, "signed in already, cant register"); // used mainly for debugging, if they're signed in, they cant register
        if(username.length <= 0 || username.length > 20) return this.returnMessage("error", true, "invalid username"); // username length checks
        if(!this.validateEmail(email)) return this.returnMessage("error", true, "invalid email"); // validates email
        if(!this.validatePassword(password)) return this.returnMessage("error", true, "invalid password"); // validates password

        this.container.db.get("SELECT * FROM User WHERE username = ? OR email = ?", [username, email], (err, row) => {
            if(err) return console.log(`Error with SQL check for email or username: ${err.message}`);
            if(!row){ // if there is no username or email the same, the user is registered and logged in
                this.container.db.run("INSERT INTO User (username, email, password, joinedAt) VALUES (?, ?, ?, ?)", [username, email, crypto.createHmac('sha256', password).digest('hex'), Date.now()], (err) => {
                    if(err) return console.log(`Error with registering user in register class: ${err.message}`); 
                    this.login(username, password); // logs the user in
                    return this.returnMessage("done", true, "registered"); // sends a message to the user saying theyre registered
                });
            } else { // if there is a username or email already registered with that name
                if(row.username == username){ // if the username or email is taken, this will be told to the user
                    return this.returnMessage("error", false, "The Username Is Taken");
                } else if(row.email == email){
                    return this.returnMessage("error", false, "The Email Is Already Registered");
                }
            }
        });
    }
    changeUsername(newUsername){
        // checks to see if the length is valid
        if(newUsername.length <= 6 || newUsername.length > 20) return this.returnMessage("error", true, "username invalid");
        if(this.signedIn){ // checks to see if the user is signed in
            this.container.db.get("UPDATE User SET username = ? WHERE userID = ?", [newUsername, this.userID]); // updates the username in the DB
            this.username = newUsername; // updates the username in the user instance
            this.container.printDatabase();
            return this.returnMessage("done", true, "username changed");
        } else {
            return this.returnMessage("error", true, "user not signed in");
        }
    }
    returnMessage(type, internal, content){
        // types: error, done, message, update
        console.log(`Event: ${type}, internal?:${internal},\ncontent: ${JSON.stringify(content)}`); // console logs this for debugging
        this.ws.send(JSON.stringify({"event": type, "internal": internal, "content": content}));// sends the data to the user
    }
    
    getGame(){ // returns the game the user is in, I intend to have user.game instead of this at some point
        for(var i =0; i < this.container.games.length; i++){ // for each game in container.games
            if(this.container.games[i].players.find(player => player.user === this)) return this.container.games[i]; // if the player is found in the game, return the game
        }
        return false; // if there is no game found, return false
    }
    processIncomingMessage(message){
        try{ // If the given JSON is invalid, an error will be returned
            var msgData = JSON.parse(message);
        } catch(e) { 
            return this.returnMessage("error", true, "JSON invalid"); // returns error, mainly for debugging
        }
        if(!msgData.action) return this.returnMessage("error", true, "invalid request"); // all messages need to have an "action", this says what they are for
        if(msgData.action == "login"){
            this.login(msgData.username, msgData.password);
        } else if(msgData.action == "sign in as guest"){
            this.signInAsGuest();
        } else if(msgData.action == "register"){
            this.register(msgData.username, msgData.password, msgData.email);
        } else if(msgData.action == "logout"){
            this.logOut();
        } else if(msgData.action == "get"){
            // if()
        } else if(msgData.action == "get container"){ // this sends the data over to the data container to make games for example
            this.container.incomingRequest(this, msgData);
        } else if(msgData.action == "game"){
            let game = this.getGame();
            if(game){
                this.getGame().incomingRequest(this, msgData); // if they're in a game, they get
            } else {
                if(!msgData.request) return this.returnMessage("error", true, "invalid request"); // if there is no request and the action is game, its an invalid request
                if(msgData.request == "join game"){
                    if(!this.signedIn) return this.returnMessage("error", true, "user not signed in"); // checks if the user is signed in before they can join a game
                    // checks the request to see if its all valid
                    if(!msgData["game name"]) return this.returnMessage("error", true, "invalid request, no game name");
                    let game = this.container.games.find(game => game.gameName == msgData["game name"]);
                    if(!game) return this.returnMessage("error", true, "game does not exist");
                    if(!game.joinable) return this.returnMessage("error", true, "game is not joinable");
                    if(this.getGame()) return this.returnMessage("error", true, "user already in game");
                    if(game.private){ // if the game is private, check for password
                        if(!msgData.password) return this.returnMessage("error", true, "no game password provided for private game");
                        if(msgData.password != game.password) return this.returnMessage("error", false, "Incorrect Password!");
                            game.addPlayer(this);
                    } else {
                        game.addPlayer(this);
                    }
                } else {
                    this.returnMessage("error", true, "not in game");
                }
            }
        } else if(msgData.action == "update"){
            if(!msgData.request) return user.returnMessage("error", true, "invalid request");

            if(msgData.request == "change email"){
                if(!msgData.email) return user.returnMessage("error", true, "invalid request");
                this.changeEmail(msgData.email);
            } else if(msgData.request == "change password"){
                if(!msgData.password) return user.returnMessage("error", true, "invalid request");
                this.changePassword(msgData.password);
            } else if(msgData.request == "add new deck"){
                if(!msgData.deck) return user.returnMessage("error", true, "invalid request");
                this.addDeck(msgData.deck, msgData.private);
            }
        }
    }
    addDeck(deck, privateBool){ // privateBool would have been "private", but javascript doesn't like that
        //try{ // checks to see if the JSON is valid
        //var deck = JSON.parse(deckInJSON);
        //} catch(e){
            //return this.returnMessage("error", false, "Invalid JSON!");
        //}
        // checks some basic varibles of the object
        if(!deck.name || !deck["white cards"] || !deck["black cards"]) return this.returnMessage("error", true, "invalid request, no name or whiteCards or blackCards");
        if(deck.name > 20 || deck.name < 4) return this.returnMessage("error", true, "invalid deck name length");
        if(!Array.isArray(deck["white cards"]) || !Array.isArray(deck["black cards"])) return this.returnMessage("error", true, "invalid request, whiteCards or blackCards is not an array");
        this.container.db.get("SELECT * FROM Deck WHERE name = ?", [deck.name], (err, row) => {
            if(err) return console.log("error with addDeck, SQL query to find if deck name is unique: "+err);
            if(row) return this.returnMessage("error", false, "Deck Name Is Already In Use! Choose A Different Name");
            this.container.db.serialize(() => {
                this.container.db.run("INSERT INTO Deck (userID, time, name, public) VALUES (?, ?, ?, ?)", [this.userID, Date.now(), deck.name, privateBool], (err, row) => {
                    if(err) console.log("error inserting deck into database");
                });
                this.container.db.get("SELECT deckID FROM Deck WHERE name = ?", deck.name, (err, row) => {
                    if(err) console.log("error inserting deck into database");
                    deck["white cards"].forEach((card) => {
                        this.container.db.run("INSERT INTO Card (deckID, cardType, cardsToPick, cardText) VALUES (?, true, 0, ?)", [row.deckID, card]);
                    });
                    deck["black cards"].forEach((card) => {
                        this.container.db.run("INSERT INTO Card (deckID, cardType, cardsToPick, cardText) VALUES (?, false, ?, ?)", [row.deckID, card.cardsToPick, card.cardText]);
                    });
                    return this.returnMessage("done", false, "Deck Has Been Added!");
                });
            });
        });
    }
    changeEmail(newEmail){
        if(!this.signedIn) return this.returnMessage("error", true, "invalid request, email cannot be changed when user is not signed in");
        
        /*
        if(email.length <= 0 || email.length > 60) return this.returnMessage("error", true, "invalid email length");
        if(email.indexOf('@') < 1 || email.indexOf('@') >= email.indexOf('@') + email.indexOf('.')) return this.returnMessage("error", true, "invalid email, wrong format");
        if(email.split('@').length != 2 || email.split('@')[1].split('.')[0].length < 1 || email.split('@')[1].split('.')[1].length < 1) return this.returnMessage("error", true, "invalid email, wrong format");
        */

        // checks email validity and length
        if(!this.validateEmail(newEmail)) return this.returnMessage("error", true, "invalid email");
        this.container.db.get("SELECT email FROM User WHERE userID = ?", [this.userID], (err, row) => {
            if(err || !row) return console.log("SQL error with changing email: "+err); // if there is no result or an error, log it to the console
            if(newEmail == row.email) return this.returnMessage("error", false, "invalid request, new email is the same as the old one"); // if the email is the same, its not going to be updated
            this.container.db.get("SELECT userID FROM User WHERE email = ?", [newEmail], (err, row) => { // checking to see if there is another user with the same email
                if(err) return console.log("error with SQL query checking if email is already registered in changeEmail: "+err);
                if(row) return user.returnMessage("error", false, "Email Is Already Registered With Another Account!");
                this.container.db.run("UPDATE User SET email = ? WHERE userID = ?", [newEmail, this.userID], (err) => {
                    if(err) return console.log("error with updating email: "+err); // console logs because its a database error if err is true
                    this.container.printDatabase();
                    return this.returnMessage("done", false, "Email Updated!"); // tells the user that its successful
                });
            });
        });
    }
    validateEmail(email){ // validation email function, I had this chunk of code repeated and decided it was better to be made a function
        // This makes sure that the email @ and . sign are there with characters inbetween so the minimum email would be L@L.L
        if(email.length <= 0 || email.length > 60) return false;
        if(email.indexOf('@') < 1 || email.indexOf('@') >= email.indexOf('@') + email.indexOf('.')) return false;
        if(email.split('@').length != 2 || email.split('@')[1].split('.')[0].length < 1 || email.split('@')[1].split('.')[1].length < 1) return false;
        return true;
    }
    validatePassword(password){
        if(password.length > 30 || password.length < 6) return false; // length check on the password
        if(!/\d/.test(password)) return false; // looks for numbers in the string, if there are none it returns false
        return true;
    }
    changePassword(newPassword){
        if(!this.signedIn) return this.returnMessage("error", true, "invalid request, user needs to be signed in before password can be changed");
        if(!this.validatePassword(newPassword)) return this.returnMessage("error", true, "invalid password");

        this.container.db.get("SELECT password FROM User WHERE userID = ?", [this.userID], (err, row) => { // gets the old password to see if they are the same
            if(err) return console.log("error with SQL query in changePassword: "+err);
            var passwordHash = crypto.createHmac('sha256', newPassword).digest('hex'); // hashes the password
            if(row.password == passwordHash) return this.returnMessage("error", false, "Your New Password Cannot Be The Same As Your Old One!"); // this sends a message to the user
            this.container.db.run("UPDATE User SET password = ? WHERE userID = ?", [passwordHash, this.userID], (err) => { // if all is good, it updates the password
                if(err) return console.log("error with updating new password: "+err);
                return this.returnMessage("done", false, "Password Updated!");
            });
        });
    }
    getSignedIn() { // will be made redundent
        return this.signedIn;
    }
    getUsername(){ // redundent function, not used
        if(this.signedIn){
            return this.username;
        } else {
            return false;
        }
    }
    getEmail(){ // redundent function, not used
        if(this.signedIn){
            return this.email;
        } else {
            return false;
        }
    }
    setPrivateDecks(){ // obsolete
        // checks to see if the user is signed in as they need to be
        if(!this.signedIn) return this.returnMessage("error", true, "invalid request, Cannot get decks when user is not signed in");
        this.container.db.all("SELECT * FROM Deck WHERE userID = ? AND public = false", [this.userID], (err, rows) => { // returns an array of all the decks that the user owns and that are private
            if(err) return console.log(`Error with get decks SQL query: ${err}`);
            rows.forEach((deck) => {
                this.db.all("SELECT * FROM Card WHERE deckID = ?", deck.deckID, (err, rows) => {
                    if(err) return console.log(`Error with get decks SQL query: ${err}`);
                    let whiteCardCount = rows.filter(card => card.cardType).length;
                    let blackCardCount = rows.length-whiteCardCount;
                    this.privateDecks.push({"name": deck.name, "deckID": deck.deckID, "white card count": whiteCardCount, "black card count": blackCardCount, "private": true});
                });
            });
        });
    }
}