const Deck = require('./deck.js');
var _ = require('underscore');
var striptags = require('striptags');

/*
TODO: 
allow users websockets to disconnect and reconnect and be put into the same game with the cookie for the ID

*/

module.exports = class Game {
    constructor(host, container, name, password){
        // *********** initialising the attributes ***********
        this.container = container;
        this.gameName = name;
        this.status = "setup"; // Statuses: setup, choosing white cards, choosing winner, finished
        this.round = 0;
        this.rounds = 10;
        this.host = {};
        this.czar = host;
        this.winner = {};
        this.players = [];
        this.decks = [];
        //this.blackCard = {};
        this.chosenCards = [];
        //this.winningCard;
        this.stageEndingTime = -1;
        this.roundTimes = {
            "choosing white cards": 40000,
            "choosing white cards multiplier": 10000,
            "choosing winner": 30000, 
            "showing winner": 5000,
        };
        this.nextRoundTimeout = function () {};
        this.maxCardsInHand = 10;
        this.joinable = true;
        
        if(password){ // if there is a password passed, the game is private
            if(password.length > 3 && password.length < 30){ // if the password is the right length
                this.private = true;
                this.password = password;
            } else { // otherwise have it public, as it's already been checked client side so this shouldn't run with normal clients
                this.private = false;
                this.password = "";
            }
        } else {
            this.private = false;
            this.password = "";
        }
        this.setHost(host);
        this.addPlayer(host);
        //setTimeout(() => this.host.returnMessage("update", true, {"decks available": this.container.publicDecks.concat(this.host.privateDecks)}), 150);
    }
    startGame(){
        // this makes sure there are enough black question cards for the game
        let blackCards = 0;
        this.getDecksAdded().forEach(deck => blackCards += deck["black card count"]);
        if(blackCards < this.rounds) return this.host.returnMessage("error", false, "There are not enough black cards for the amount of rounds!");

        // this makes sure there are enough white answer cards for the game, if there are too few for the rounds and players, considering the "maxCardsInHand", it will not run
        let whiteCards = 0;
        this.getDecksAdded().forEach(deck => whiteCards += deck["white card count"]);
        if(whiteCards/(this.players.length) < this.maxCardsInHand+(this.rounds*this.players.length)) return this.host.returnMessage("error", true, "There are not enough white cards for players and rounds!");

        // this sets the status so the clients and the game running can work properly
        this.status = "choosing white cards";
        // this sets the stage ending time and allows for the timer to work and the clients know when the round is over then
        this.stageEndingTime = Date.now()+this.roundTimes[this.status];
        // this gets the black card that the players pick the answers to
        this.blackCard = this.getCard(false);
        // resets all of the players cards if there was a game before
        

        // this gives all the players new cards
        this.players.forEach((player) => {
            this.giveCards(player);
        });
        // this sends the new game information out to the players
        this.broadcastGameData();
        // finally, this is the timer to go to the next stage, (choosing winner)
        this.nextRoundTimeout = setTimeout(() => {
            this.goToNextStage();
        }, this.stageEndingTime-Date.now()); // the stageEndingTime is used to determine how long the timeout is
    }
    goToNextStage(){
        clearTimeout(this.nextRoundTimeout); // Clears any timeout to run it again, if it has been run early and not by the timeout
        
        if(this.status == "setup"){
            this.startGame();
        } else if(this.status == "choosing white cards"){ // end choosing white card stage
            this.status = "choosing winner"; // this sets the status so if there is a request to choose the winning card, it allows it
            this.stageEndingTime = Date.now()+this.roundTimes["choosing winner"]; // so the user and the game knows when this stage ends
            this.broadcastGameData();
            this.nextRoundTimeout = setTimeout(() => { // sets the time out
                this.goToNextStage();
            }, this.stageEndingTime - Date.now());
        } else if(this.status == "choosing winner"){
            if(this.round < this.rounds){ // checks to see if there are any more rounds to play
                if(!this.winner.ws){ // if the czar didnt pick the winner, remove them for being AFK, prob should change
                    let czarPlayer = this.players.find(player => player.user == this.czar);
                    this.removePlayer(czarPlayer);
                } else {
                    this.winner = {};
                }
                this.status = "choosing white cards";
                this.round ++;
                this.players.forEach((player) => {
                    /*player["cards chosen"].forEach(() => {
                        player["cards in hand"].push(this.getCard(true)); // gives a new card for every card used
                    });*/
                    this.giveCards(player);
                    player["cards chosen"] = []; // clears the cards chosen array for the player
                });
                this.blackCard = this.getCard(false); // sets the new black card
                this.changeCzar();
                this.stageEndingTime = Date.now()+this.roundTimes["choosing white cards"]+(this.roundTimes["choosing white cards multiplier"]*this.blackCard.cardsToPick);
                this.nextRoundTimeout = setTimeout(() => { // sets the time out
                    this.goToNextStage();
                }, this.stageEndingTime - Date.now());
                this.broadcastGameData(); // sends the updated game data out
            } else {
                this.finishGame();// tell all the players that the game has finished
            }
        } else if(this.status == "finished"){ // if the game is finished and this function is ran, it starts the game
            this.startGame();
        }
    }
    giveCards(player){ // this gives new cards to make sure that the player always has the "maxCardsInHand" amount of cards
        if(player["cards in hand"].length > this.maxCardsInHand){ // if the player has too many cards
            player["cards in hand"] = player["cards in hand"].slice(0, this.maxCardsInHand); // "slice" the array down to the amount they should have
        } else {
            for(var i = player["cards in hand"].length; i < this.maxCardsInHand; i++){ // because i is set to the cards in hand length and it goes up to the maxCardsInHand so they will always have the right amount
                player["cards in hand"].push(this.getCard(true));
            }
        }
    }
    getCard(type){ // this function gets a card randomly
        /*

        This function selects a random card from all the cards in all the decks
        it then goes through and sees if the randCard would be within that deck
        if it's not, it goes onto the next deck and adds the count of the cards
        it's been through to the cards count until it gets to the card that it's
        looking for

        */
        if(this.decks.length == 0) return console.log("can't get a card when there are no decks"); // this console.log is to for debugging, it shouldn't appear and is a server side error as it should have been checked
        var total = 0;
        var lengths = [];
        this.decks.forEach((deck) => {
            let length = deck.getCardCount(type);
            lengths.push(length);
            total += length;
        });
        var randCard = Math.floor(Math.random() * total);
        var cards = 0;
        for(var i = 0; i < this.decks.length; i++){ // for every deck until it returns
            if(cards+this.decks[i].getCardCount(type) > randCard){ // sees if the card is in that deck
                return this.decks[i].getCard(type, randCard-cards); // if it is the right card it returns it
            } else {
                cards += this.decks[i].getCardCount(type); // adds deck length to cards to check
            }
        }
        // it shouldn't ever get to here, but if it does, theres a console log to tell me and help debug
        return console.log("error with getting a white card in deck, for loop completed without getting a card");
    }
    setPrivateState(state, password){ // this is for setting the private state after the game has been created
        if(state){
            if(password){
                if(password.length > 5 && password.length < 21){
                    this.private = true;
                    this.password = password;
                } else {
                    console.log("invalid password length recieved in setPrivateState");
                }
            } else {
                console.log("no password provided for private game");
            }
        } else {
            this.private = false;
        }
    }
    addPlayer(user){
        user.inGame = true;
        let playerObject = { // the player object contains the player information
            "user": user, // pointer to the user instance
            "score": 0,
            "cards in hand": [],
            "cards chosen": [],
            "lastDataSent": {game:{}} // this is to remember what data needs to be sent to the client to keep them updated
        };
        if(this.status == "choosing white cards" || this.status == "choosing winner"){ // if the game is running, give them cards
            this.giveCards(playerObject);
        }
        this.players.push(playerObject); // adds them to the players array
        this.container.sendGamesUpdate(); // tells everyone on the home/games screen that there's a new player
        this.broadcastGameData(); // tells the other users that there's a new player
        console.log(`${user.username} joined game ${this.gameName}`); // for debugging, logs the player joining to the console
        //this.status = "setup"; // Statuses: setup, choosing white cards, choosing winner, finished
        // ^^ this adds to the array players, then sends the game data to the user, with the returned value
    }
    removePlayer(player){ // should probably make this remove user
        if(!player) return;
        console.log(`Player Removed from ${this.gameName}, username: ${player.user.username}`);
        player.user.inGame = false;
        player.user.returnMessage("update", true, {"left game": true, "games running": this.container.getGames()}); // tells the player that they've left the game and the games running currently for the games page they'll be going to
        this.players = this.players.filter(value => value != player); // removes player from array
        if(this.players.length < 2) {
            this.finishGame();
        }
        this.container.sendGamesUpdate(); // sends the game update to anyone on the home screen to see that there's an update
        this.broadcastGameData(); // this tells the other players in the game that someone's left
    }
    sendMessage(user, message){ // this sends the message to everyone in the game
        message = striptags(message);
        for(var i = 0; i < this.players.length; i++) {
            this.players[i].user.returnMessage("message", "true", {"from": user.username, "contents": message});
        }
        return true;
    }
    incomingRequest(user, data){ // this handles the requests from the players
        if(!data.request) return user.returnMessage("error", true, "no request");
        if(data.request == "message"){
            if(!data.content) return user.returnMessage("error", true, "no message to send!");
            data.content = data.content.trim(); // trimmming the message so the spaces at the start/end are removed
            this.sendMessage(user, data.content);
            return user.returnMessage("done", true, "message sent");
        }   
        if(user == this.host){
            if(data.request == "change max cards in hand"){
                if(!data.maxCards) return user.returnMessage("error", true, "no max cards provided");
                if(data.maxCards <= 40 && data.maxCards >= 5){
                    return this.updateMaxCardsInHand(data.maxCards);
                } else {
                    return user.returnMessage("error", true, "max cards invalid range");
                }
            } else if(data.request == "add deck"){
                if(data.deckID){ // checks to see if the deck ID is there
                    return this.addDeck(data.deckID, user);
                } else {
                    return user.returnMessage("error", true, "invalid request");
                }
            } else if(data.request == "remove deck"){
                if(data.deckID){
                    return this.removeDeck(data.deckID, user);
                } else {
                    return user.returnMessage("error", true, "invalid request");
                }
            } else if(data.request == "start game"){
                if(this.players.length >= 3){ // checks to see if there are more than x amount of players
                    if(this.decks.length > 0){ // checks to see if there are any decks
                        if(this.status != "setup" && this.status != "finished") return user.returnMessage("error", true, "invalid request, game already running!");
                        return this.startGame();
                    } else {
                        return user.returnMessage("error", true, "invalid request, no decks selected");
                    }
                } else {
                    return user.returnMessage("error", true, `invalid request, not enough players, 3 are needed minimum, current: ${this.players.length}`);
                }
            } else if(data.request == "leave game"){
                if(this.players.length > 1){  // if there is more than one player
                    this.setHost(this.players[1].user);// chooses the next player as the host
                    if(user == this.czar){ // if the czar wants to leave, switch them
                        this.changeCzar();
                    }
                    return this.removePlayer(this.players.find(player => player.user == user));
                } else {
                    //this.removePlayer(this.players.find(player => player.user == user))
                    return this.container.removeGame(this); // removes the game from the container, this will remove the player
                }
            }
        } else {
            if(data.request == "leave game"){
                if(user == this.czar){
                    this.changeCzar();
                }
                return this.removePlayer(this.players.find(player => player.user == user));
            }
        }
        if(user == this.czar){
            if(data.request == "choose winner"){
                if(this.status == "choosing winner"){
                    // the czar client submits the first card in the submitted winning cards!
                    //if(!data.cardID) return user.returnMessage("error", true, "invalid request, no cardID given"); // checks for cardID
                    if(!data.cardID) return user.returnMessage("error", true, "invalid request, no cardID given!");
                    let player = this.players.find(player => player["cards chosen"].find(card => card.cardID == data.cardID));
                    if(!player) return user.returnMessage("error", true, "invalid request, player not in game");
                    //let card = this.getChosenCards.find(cardOBJArr => cardOBJArr.cards.find(cardOBJ => cardOBJ.card.cardID == data.cardID));
                    //if(!card) return user.returnMessage("error", true, "invalid request, card(s) sent not in cardChosen");
                    if(this.winner.ws) return user.returnMessage("error", true, "invalid request, winner has already been chosen");
                    return this.chooseWinner(player);
                } else {
                    return user.returnMessage("error", true, "invalid request");
                }
            }
        } else {
            if(data.request == "submit cards"){
                if(this.status != "choosing white cards") return user.returnMessage("error", true, "invalid request, not choosing white cards");

                if(!data.cards) return user.returnMessage("error", true, "invalid request, no cards array given");
                if(data.cards.length != this.blackCard.getCardsToPick()) return user.returnMessage("error", true, "invalid request, wrong amount of cards chosen"); // I need to have these checks in two seperate lines, otherwise if cards didnt exist, it would crash saying "couldn't find length of unknown"
                let player = this.players.find(player => player.user == user);
                if(player["cards chosen"].length > 0) return user.returnMessage("error", true, "invalid request, cards already chosen this round"); // this is so the player cant submit multiple cards, if there is anything in the "cards chosen" array, they've already submitted their cards that round

                return this.playCards(data.cards, player);
            } else {
                return user.returnMessage("error", true, "invalid request");
            }
        }
    }
    chooseWinner(player){
        player.score ++;
        this.winner = player.user;
        this.broadcastGameData();
        clearTimeout(this.nextRoundTimeout);
        this.nextRoundTimeout = setTimeout(() => {
            this.goToNextStage();
        }, this.roundTimes["showing winner"]*this.blackCard.cardsToPick); // Waits longer as it would take longer to read more cards
    }
    changeCzar(){
        let index = this.players.findIndex(player => player.user == this.czar)+1; // gets the index of the czar
        //index >= this.players.length ? this.czar = this.players[0].user : this.czar = this.players[index].user; // if the index of the old czar+1 is valid for a new index for the czar, set it, otherwise set czar to index 0
        if(index >= this.players.length){
            if(this.players.length > 0) {
                this.czar = this.players[0].user;
            } else {
                this.container.removeGame(this); // gg bois, it was a good run
            }
        } else {
            this.czar = this.players[index].user;
        }
    }
    addDeck(deckID, user){
        if(this.decks.find(deck => deck.deckID == deckID)) return user.returnMessage("error", false, "Deck Has Already Been Added!"); // checks to see if the deck has already been added
        this.container.db.get("SELECT * FROM Card WHERE deckID = ?", [deckID], (err, row) => { // checks to see if the deck exists
            if(err) return console.log(`Error adding deck in game class: ${err}`);
            if(row){
                this.decks.push(new Deck(deckID, this));
                this.broadcastGameData();
            } else {
                user.returnMessage("error", false, "That Deck Does Not Exist!");
            }
        });
    }
    removeDeck(deckID, user){
        let Odeck = this.decks.find(deck => deckID == deck.deckID);
        if(!Odeck) return user.returnMessage("error", true, "invalid request, deck not added");
        this.decks = this.decks.filter(deck => deck != Odeck)
        this.broadcastGameData();
    }
    sendGameData(player){
        if(player.ws){ // this is needed for debugging, just in case I call user and not player
            return console.log("called user and not player!");
        }
        let dataToSend = {
            game: {
                "host": this.host.username,
                "game name": this.gameName,
                "decks added": this.getDecksAdded(), // returns, in an array, for every deck, with it's name and ID
                "players": this.getPlayerList(), 
                "czar": this.czar.username,
                "winner": this.winner.ws ? this.winner.username : "",
                "black card": this.blackCard ? {"text": this.blackCard.getCardText(), "cards to pick": this.blackCard.getCardsToPick()} : null,
                "cards chosen": this.getChosenCardsToSend(player),
                "cards in hand": this.getCardsInHand(player),
                "round": this.round, 
                "rounds": this.rounds,
                "status": this.status, 
                "stage ending time": this.stageEndingTime/*,
                "winning card": this.winningCard ? {"cardID": this.winningCard.card.getID(), "player": this.winningCard.play.user.username} : null*/
            }
        };
        if(dataToSend != player.lastDataSent){ // if the data that was sent last has changed
            let reducedData = {game: {}};
            Object.keys(dataToSend.game).forEach((item) => { // this adds the changed data to the object "reducedData", saving bandwidth
                if(!(player.lastDataSent.game && _.isEqual(player.lastDataSent.game[item], dataToSend.game[item]))){ // if nothing has been sent before, or the data has changed, add it to reduced data
                    reducedData.game[item] = dataToSend.game[item];
                }
            });
            player.lastDataSent = dataToSend;
            //let reducedJSONdata = JSON.stringify(reducedData);
            player.user.returnMessage("update", true, reducedData);
        }
    }
    getChosenCards(){
        return this.players.filter(player => player["cards chosen"].length > 0).map((player) => { // for every player, get their cards chosen
            return {"player": player, "cards": player["cards chosen"]};
        });
    }
    getChosenCardsToSend(player){ // this function exists because the czar shouldn't get the player names for who submitted what
        if(player.user == this.czar && !this.winner.ws){
            return this.getChosenCards().map((entry) => {
                //console.log(`Cards: ${JSON.stringify(cards)}`);
                return {
                    "cards": entry.cards.map((card) => { 
                        return {"card text": card.getCardText(), "card ID": card.getID()}; 
                    })
                };
                
            });
        } else {
            return this.getChosenCards().map((entry) => {
                //console.log(`Cards: ${JSON.stringify(cards)}`);
                return {
                    "username": entry.player.user.username, 
                    "cards": entry.cards.map((card) => { 
                        return {"card text": card.getCardText(), "card ID": card.getID()}; 
                    })
                };
                
            });
        }
    }
    getCardsInHand(player){
        return player["cards in hand"].map(card => {
            return {"ID": card.getID(), "text": card.getCardText()};
        });
    }
    broadcastGameData(){
        this.players.forEach((player) => {
            this.sendGameData(player);
        });
        //this.sendGameData(this.host);
        return true;
    }
    getPlayerList(){
        return this.players.map(player => {
            return {"username": player.user.username, "score": player.score};
        });
    }
    updateMaxCardsInHand(max){
        if(max > 39 || max < 6){
            console.log(`could not update maxCardsInHand in game class, ${max} is not within range`);
        } else {
            this.maxCardsInHand = max;
            if(this.status == "choosing white cards" || this.status == "choosing winner"){ // if the game is running, give the people the new cards
                this.players.forEach((player) => {
                    this.giveCards(player);
                });
                this.broadcastGameData();
            }
        }
    }
    getDecksAdded(){ 
        return this.decks.map((deck) => {
            return {"id": deck.deckID, "name": deck.getDeckName(), "white card count": deck.getCardCount(true), "black card count": deck.getCardCount(false)}
        });
    }
    playCards(cards, player){ // cards should be an array of indexes
        /*let chosenCard = {
            "player": player,
            "cards": card
        };
        this.chosenCards.push(chosenCard); */
        for(var i=0; i < cards.length;i++){
            for(var j=cards.length; j > i+1; j--){
                if(cards[i] == cards[j]){
                    return player.user.returnMessage("error", true, "invalid request, duplicate indexes!");
                }
            }
        }
        for(var i=0; i < cards.length; i++){
            let cardIndex = cards[i];
            if(cardIndex < 0 || cardIndex > player["cards in hand"].length) return player.user.returnMessage("error", true, "invalid request, card index out of range");
            player["cards chosen"].push(player["cards in hand"][cardIndex]);
        }
        player["cards in hand"] = player["cards in hand"].filter((card) => !player["cards chosen"].find(chosenCard => chosenCard == card));

        if(this.getChosenCards().length >= this.players.length-1){
            this.goToNextStage();
        } else {
            this.broadcastGameData();
        }
    }
    setHost(host){ // host should be user
        if(this.status == "setup"){
            this.host = host;
            this.container.sendDecksAvailable(this.host);
        } else {
            this.host = host;
        }
    }
    finishGame(){
        this.status = "finished";
        this.decks = [];
        this.czar = this.host;
        this.winner = {};
        this.round = 0;
        this.decks = [];
        this.players.forEach((player) => {
            player["cards chosen"] = [];
            player["cards in hand"] = [];
            // db.exec("INSERT INTO Game_History (userID, time, score) VALUES (1, 1570284327, 11)");
            this.container.db.run("INSERT INTO Game_History (userID, time, score) VALUES (?, ?, ?)", (player.user.userID, Date.now(), player.score), (err) => {
                if(err) console.log("Error inserting into game history: "+err);
                player.score = 0;
            });
        });
        this.broadcastGameData();
    }
    changeHost(newHost){// depreciated
        if(newHost){
            if(this.player.find(player => player == newHost)){
                this.host = newHost;
                this.broadcastGameData();
            } else {
                console.log("error changing host, new host is not in game");
            }
        } else {
            console.log("error changing host, new host is invalid");
        }
    }
    getGameName(){// depreciated
        return this.gameName;
    }
    getMaxCardsInHand(){// depreciated
        return this.maxCardsInHand;
    }
    findCard(cardID, type){// depreciated
        this.decks.forEach((deck) => {
            let card = deck.getCardbyCardID(type, cardID);
            if(card){
                return card;
            }
        });
        return false;
    } 
    updateBlackCard(newCard){ // depreciated
        this.blackCard = newCard;
        this.broadcastGameData();
    }
}