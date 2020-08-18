module.exports = class Card {
    constructor(deck, cardID, type, text, cardsToPick){
        this.deck = deck;
        this.cardID = cardID;
        this.type = type;
        this.text = text;
        if(!type) this.cardsToPick = cardsToPick;
    }
    getID(){
        return this.cardID;
    }
    getCardText(){
        return this.text;
    }
    getCardType(){
        return this.cardType;
    }
    getCardsToPick(){
        if(this.cardType) return console.log(`Cannot get cards to pick of a white card`);
        return this.cardsToPick;
    }
}