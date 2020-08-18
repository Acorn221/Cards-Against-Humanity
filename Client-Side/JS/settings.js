function handleJSONDeck(event) {
    var deckJSON = event.target.result;
    try{
        var deck = JSON.parse(deckJSON);
    } catch(e){
        return $("#settingsInner").notify("Invalid JSON in deck file!", {className: "error", position: "top right"});
    }
    if(!deck.name) return $("#settingsInner").notify("No Deck Name Given In JSON File", {className: "error", position: "top right"});
    if(deck.name > 20 || deck.name < 4) return $("#settingsInner").notify("invalid deck name length", {className: "error", position: "top right"});
    if(!deck["white cards"] || !deck["black cards"]) return $("#settingsInner").notify("Missing 'white cards' or 'black cards'!", {className: "error", position: "top right"});
    if(!Array.isArray(deck["white cards"]) || !Array.isArray(deck["black cards"])) return $("#settingsInner").notify("'white cards' or 'black cards' Isn't an array!", {className: "error", position: "top right"});
    for(var i=0; i < deck["black cards"].length; i++){
        if(!deck["black cards"][i].text || !deck["black cards"][i].cards) return $("#settingsInner").notify("'black cards' array needs to be an object and needs to have 'text' and 'cards'!", {className: "error", position: "top right"});
    }
    let checkBoxValue = document.getElementById("privateDeckCheckbox").checked;
    //console.log(`Would Send to the websocket: ${JSON.stringify({"action": "update", "request": "add new deck", "deck": deck, "private": checkBoxValue})}`)
    websocket.send(JSON.stringify({"action": "update", "request": "add new deck", "deck": deck, "private": checkBoxValue}));
}
function handleDeckSelect(evt) {
  evt.stopPropagation();
  evt.preventDefault();

  var files = evt.dataTransfer.files; // FileList object.

    for(var i=0;i<files.length;i++){
        let reader = new FileReader();
        reader.readAsText(files[i]);
        reader.addEventListener("load", handleJSONDeck);
    }
}
function handleDragOverForDeckUpload(evt) {
  evt.stopPropagation();
  evt.preventDefault();
  evt.dataTransfer.dropEffect = 'move'; // to come up when the mouse has a file dragged over
}

var dropZone = document.getElementById('fileDropArea');
dropZone.addEventListener('dragover', handleDragOverForDeckUpload, false);
dropZone.addEventListener('drop', handleDeckSelect, false);