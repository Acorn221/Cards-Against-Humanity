const Card = require('./card.js');

module.exports = class Deck {
    constructor(deckID, game){
        this.game = game;
        this.deckID = deckID;
        this.name = "";
        this.whiteCards = [];
        this.blackCards = [];
        this.game.container.db.serialize(() => {
            this.game.container.db.get("SELECT name FROM Deck WHERE deckID = ?", this.deckID, (err, row) => { // this just gets the deck name from the ID
                if(err) return console.log(`Error with get deck name SQL query: ${err}`);
                this.name = row.name; // *******************
            });
            this.game.container.db.all("SELECT * FROM Card WHERE deckID = ?", [this.deckID], (err, rows) => { // this gets all the cards in the deck
                if(err) return console.log(`Error with get cards SQL query: ${err}`);
                for(var i=0;i<rows.length;i++){
                    if(rows[i].cardType){   // white card
                        this.whiteCards.push(new Card(this, rows[i].cardID, true, rows[i].cardText));
                    } else {                // black card
                        this.blackCards.push(new Card(this, rows[i].cardID, false, rows[i].cardText, rows[i].cardsToPick));
                    }
                }
                this.game.broadcastGameData(); // after all the cards have been added and the count for the number of cards is accurate, it sends the update to the players
                this.game.container.sendGamesUpdate(); // this gives the people waiting to join a game, on the games page an update on the deck thats been added
            })
        });
        
    }
    getCard(type, card){
        if(type){ // is it black or white
            if(card){ // has there been a card index given?
                if(this.whiteCards[card]){ // is the index valid?
                    this.whiteCards = this.whiteCards.filter(value => value.cardText != this.whiteCards[card]); // remove card from array
                    return this.whiteCards[card]; // return card
                } else {
                    //return console.log(`Error getting white card, ${card} is not in the range of 0 to ${this.whiteCards.length}`);
                    return false; // return false if the index is invalid
                }
            } else { // if no index is given, it chooses a random card, then removes it from the deck so it cant be drawn again
                let cardChosen = Math.floor(Math.random() * this.whiteCards.length);
                let cardToReturn = this.whiteCards[cardChosen];
                this.whiteCards = this.whiteCards.filter(value => value.cardText != this.whiteCards[cardChosen]);
                return cardToReturn;
            }
        } else {
            if(card){
                if(this.blackCards[card]){
                    return this.blackCards[card];
                } else {
                    //return console.log(`Error getting black card, ${card} is not in the range of 0 to ${this.blackCards.length}`);
                    return false;
                }
            } else {
                let cardChosen = Math.floor(Math.random() * this.blackCards.length);
                let cardToReturn = this.blackCards[cardChosen]; 
                this.blackCards = this.blackCards.filter(value => value.cardText != this.blackCards[cardChosen]);
                return cardToReturn;
            }
        }
    }
    getCardByCardID(type, cardID){
        let card = type ? this.whiteCards.find(card => card.getID() == cardID) : this.blackCards.find(card => card.getID() == cardID); // card is set dependend on the type of the card
        if(card){ // if it's valid, its returned, otherwise false is returned
            return card;
        } else {
            return false;
        }
    }
    addNewCard(text){ // this is for adding custom cards
        if(!text) return console.log(`Error adding new card to deck, no text parameter`);
        if(type){   // white card
            this.whiteCards.push(new Card(this, -1, text));
        }// no adding black cards
        return true;
    }
    getCardCount(type){
        if(type){   // white card
            return this.whiteCards.length;
        } else {    // black card
            return this.blackCards.length;
        }
    }
    getCards(type){ // this is for returning all cards white or black in the deck
        if(type){ // black or white?
            return this.whiteCards.map(card => { // map returns an array, for each element in the array it the code below runs
                return {"card id": card.cardID, "card text": card.cardText};
            });
        } else {
            return this.blackCards.map(card => {
                return {"card id": card.cardID, "card text": card.cardText, "cards to pick": card.cardsToPick};
            });
        }
    }
    getAllCards(){ // just for getting the whole deck
        return {"white cards": this.getCards(true), "black cards": this.getCards(false)};
    }
    getDeckName(){ // depreciated
        return this.name;
    }
    removeCard(cardID){ // depreciated, probably not going to use

    }
    getWhiteCards(){ // depreciated
        console.log("error, getWhiteCards() was used :(");
    }
    getBlackCards(){ // depreciated
        console.log("error, getBlackCards() was used :(");
    }
    getWhiteCard(card){ // depreciated
        if(card){
            if(this.whiteCards[card]){
                return this.whiteCards[card];
            } else {
                return console.log(`Error getting white card, ${card} is not in the range of 0 to ${this.whiteCards.length}`);
            }
        } else {
            let cardChosen = Math.floor(Math.random() * this.whiteCards.length);
            let cardToReturn = this.whiteCards[cardChosen];
            this.whiteCards = this.whiteCards.filter(value => value.cardText != this.whiteCards[cardChosen]);
            return cardToReturn;
        }
    } 
    getBlackCard(card){ // depreciated
        if(card){
            if(this.blackCards[card]){
                return this.blackCards[card];
            } else {
                return console.log(`Error getting black card, ${card} is not in the range of 0 to ${this.blackCards.length}`);
            }
        } else {
            let cardChosen = Math.floor(Math.random() * this.blackCards.length);
            let cardToReturn = this.blackCards[cardChosen]; 
            this.blackCards = this.blackCards.filter(value => value.cardText != this.blackCards[cardChosen]);
            return cardToReturn;
        }
    }
}