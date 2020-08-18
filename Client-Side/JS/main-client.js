 // Global Varibles
 var quotesJSON = "[{\"text\":\"Hilarious.\",\"source\":\"INC\"},{\"text\":\"Hysterical.\",\"source\":\"TIME\"},{\"text\":\"Uproarious.\",\"source\":\"Polygon\"},{\"text\":\"Funny.\",\"source\":\"Boing Boing\"},{\"text\":\"Edgy.\",\"source\":\"LA Weekly\"},{\"text\":\"Good.\",\"source\":\"Daniel Radcliffe\"},{\"text\":\"Absurd.\",\"source\":\"The Chicago Tribune\"},{\"text\":\"Snarky.\",\"source\":\"AdWeek\"},{\"text\":\"Unforgivable.\",\"source\":\"The Economist\"},{\"text\":\"Stupid.\",\"source\":\"Bloomberg Businessweek\"},{\"text\":\"Bad.\",\"source\":\"NPR\"},{\"text\":\"Horrible.\",\"source\":\"Wired\"}]";
 var quotes = JSON.parse(quotesJSON); 
 var quoteBox = document.getElementById("quoteBox");
 var quote = 0;
 var gamesRunning = {};
 var gameData = {};
 var selectedCards = [];
 var loggedIn = false;
 var cardsSent = false;
 var sideBarOpen = false;
 var settingsOverlay = "";
 var websocket;
 var clippyAgent;
 var username = "";
 var page = "login"; // pages: login, home, game
 var changeQuote = function(){ 
      if(quote%quotes.length == 0 && quote != 0){
          quote = 0;
      }
      quoteBox.innerHTML = "<span class='quote'>\""+quotes[quote].text+"\"</span><span class='source'> -"+quotes[quote].source+"</span>";
      quote++;
 };
 changeQuote();
 //var allInput = document.querySelectorAll("input");
// allInput[allInput.length-1].onclick = function() { signInAsGuest() };
 var changeQuoteInterval = setInterval(changeQuote, 5000);
 //window.addEventListener("load", init, false);
 init();
/*
The window add event listner is not needed and breaks the code when the JS is ran
*/


 // Login
 function showRegister(){
     document.getElementsByClassName("register")[0].style.display = "block";
     document.getElementsByClassName("login")[0].style.display = "none";
     document.getElementsByName("username")[1].value = document.getElementsByName("username")[0].value;
     document.getElementsByName("password")[1].value = document.getElementsByName("password")[0].value;
     if(document.getElementsByName("password")[0].value != ""){
         checkPasswordComplexity(document.getElementsByName("password")[0].value);
     }
 }
 function showLogin(){
     document.getElementsByClassName("register")[0].style.display = "none";
     document.getElementsByClassName("login")[0].style.display = "block";
     document.getElementsByName("username")[0].value = document.getElementsByName("username")[1].value;
     document.getElementsByName("password")[0].value = document.getElementsByName("password")[1].value;
 }
 function checkComplexity() {
         var password = document.getElementById("register-password").value;
         var errorDOM = document.getElementById("password-complexity-error");
         if(password.length < 6){
             errorDOM.style.visibility = "visible";
             errorDOM.innerHTML = "Your Password Needs To Be Over 6 Characters!";
         } else if(!(/\d/.test(password))){
             errorDOM.innerHTML = "You Need To Have At Least One Number!";
             errorDOM.style.visibility = "visible";
         } else {
             errorDOM.style.visibility = "hidden";
             
         }
 }
 function checkPasswordComplexity(){
     checkComplexity();
     document.getElementById("register-password").addEventListener("keyup", checkComplexity);
 }
 function comparePasswords(){
     function checkPasswords(){
         var registerPassword = document.getElementById("register-password").value;
         var password = document.getElementById("confirm-password").value;
         if(password != registerPassword){
             document.getElementById("password-confirmation-error").style.visibility = "visible";
             
         } else {
             document.getElementById("password-confirmation-error").style.visibility = "hidden";
         }
         document.getElementById("register-password").addEventListener("keyup", checkPasswords);
         document.getElementById("confirm-password").addEventListener("keyup", checkPasswords);
     }
     checkPasswords();
 }
 function login(){
     username = document.getElementsByName("username")[0].value;
     var password = document.getElementsByName("password")[0].value;
     if(username.length < 1) return alert("you need to enter a username to login");
     if(password.length < 1) return alert("you need to enter a password to login");
     websocket.send(JSON.stringify({"action": "login", "username": username, "password": password}));
 }
 function register(){
     username = document.getElementsByName("username")[1].value;
     var password = document.getElementsByName("password")[1].value;
     var email = document.getElementsByName("email")[0].value;
     if(username.length <= 0 || username.length > 20) return $.notify("Invalid Username Length, It Has To Be Over ", "error");
     if(password.length > 30 || password.length < 6) return $.notify("Invalid Password Length, Must Be 7 to 30 characters", "error");
     if(!validateEmail(email)) return $.notify("Invalid Email!", "error");
     var request = {
         "action": "register",
         "username": username,
         "password": password,
         "email": email
     };

     websocket.send(JSON.stringify(request));
 }
 function signInAsGuest(){
     websocket.send(JSON.stringify({"action": "sign in as guest"}));
 }

 // Misc
 function addToLog(text, error){
         //var x = document.getElementById("iframe");
         //var y = (x.contentWindow || x.contentDocument);

         console.log(text);
         $.notify(text, error ? "error" : "success");
         //if (y.document)y = y.document;
         //y.body.innerHTML = text+"<br>"+y.body.innerHTML;
 }
 function messageRecieved(message){
     console.log(`data recieved: ${message}`);
     var data = JSON.parse(message);
     if(!data) return console.log("error with converting message from JSON");
     // types: error, done, message, update
     if(data.event == "done"){
         $.notify(data.content, "success");
     } else if(data.event == "update"){
         if(!loggedIn){
             if(data.content["logged in"]){
                 loggedIn = true;
                 showHomePage();
                 gamesRunning = data.content["games running"];
                 if(username == "") username = data.content.username;
                 console.log(JSON.stringify(gamesRunning));
             }
         } else {
             if(data.content.game){
                 if(page != "game"){
                     page = "game";
                     gameData = data.content.game;
                     showGamePage();
                     if(data.content.game.host == username){
                         $.notify("Created Game", "success");
                     } else {
                         $.notify("Joined Game", "success");
                     }
                 } else {
                     if(gameData.status == "choosing winner" && data.content.game.status == "choosing white cards"){
                         cardsSent = false;
                         if(gameData.czar == username){
                             // Allow the czar to select submitted cards
                             allowSelectingCardsForCzar();
                         }
                     }
                     if(data.content.game.czar){
                         if(gameData.czar != username && data.content.game.czar == username){ // if the user has just become a czar
                             // noClick
                             console.log("user has just become czar");
                             $.notify("You are now the czar!", {className:"info", position: "top right", autoHideDelay: 5000});
                             var ownedCardsArea = document.getElementById("ownedCardsArea").children;
                             for(var i=0; i < ownedCardsArea.length; i++){
                                 ownedCardsArea[i].classList.add("noClick");
                             }
                         } else if(gameData.czar == username && data.content.game.czar != username){ // if the user has just been removed from czar
                             console.log("user has just lost czar");
                             $.notify("You are not the czar anymore!", {className:"info", position: "top right", autoHideDelay: 5000});
                             var ownedCardsArea = document.getElementById("ownedCardsArea").children;
                             for(var i=0; i < ownedCardsArea.length; i++){
                                 ownedCardsArea[i].classList.remove("noClick");
                             }
                         } 
                     }
                     if(data.content.game.host == username && gameData.host != username){ // if the user has just become the host
                         $.notify("You are now the host of the game!", {className:"info", position: "top right", autoHideDelay: 5000});
                     }
                     if(data.content.game.winner != "" && gameData.winner == ""){ // when the winner has been chosen, run show winning card
                         showPlayersInGame(false, data.content.game.winner);
                         showCardsChosen(true);
                     }
                     if(gameData.status == "setup" && data.content.game.status == "choosing white cards"){ // if the game has started, hide the start overlay
                         console.log("hiding start overlay");
                        hideStartOverlay();
                     }
                     if(data.content.game.status == "finished" && gameData.status == "choosing winner"){ // If the game has just ended
                         var winner = {"username": "", "score": 0};
                         gameData.players.forEach(player => { // for every player, if they have the highest score seen, make them the winner
                             if(player.score > winner.score){
                                 winner.username = player.username;
                                 winner.score = player.score;
                             }
                         });
                         alert(`${winner.username} Has Won With ${winner.score} Points!`);
                     }
                     var keys = Object.keys(data.content.game);
                     for(var i = 0; i < keys.length; i++){
                             gameData[keys[i]] = data.content.game[keys[i]];
                     }
                     
                     if(gameData.status != "setup" && gameData.status != "finished"){
                         updateGameDisplay();
                     } else {
                         updateOverlay();
                         cardsSent = false;
                     }
                 }
             } else if(data.content["decks available"]){
                 gameData["decks available"] = data.content["decks available"];
                 updateDecksAvailable();
             } else if(data.content["left game"]){
                 gamesRunning = data.content["games running"];
                 showHomePage();
             } else if(data.content == "Game ended"){
                 showHomePage();
             } else if(data.content["games running"]){
                 gamesRunning = data.content["games running"];
                 showGamesRunning();
             }
         }
     } else if(data.event == "message"){
         //{"event":"message","internal":true,"content":{"from":"yeetasaurusrex","message":"ayup"}}
         var chatBox = (document.getElementById("chat").contentWindow || document.getElementById("chat").contentDocument);
         if (chatBox.document) chatBox = chatBox.document;
         var anchor = chatBox.getElementById("anchor");
         var newMessage = document.createElement('div');
         newMessage.className = "message";
         newMessage.innerHTML = `<u>${data.content.from}:</u><br>${data.content.contents}`;
         chatBox.body.insertBefore(newMessage, anchor);
     } else if(data.event == "error"){
         console.log(`server returned error: ${data.content}`);
         //if(!data.internal) return alert(data.content);
         if(!data.internal){
             if(page == "login"){
                 clippyAgent.stop();
                 
                 if(data.content == "No User Has This Username"){
                     var usernameBoxLocation = document.getElementsByName("username")[0].getBoundingClientRect();
                     clippyAgent.moveTo(usernameBoxLocation.right+10, parseInt((usernameBoxLocation.bottom+usernameBoxLocation.top)/2-40));
                     clippyAgent.speak(`Error! ${data.content}`);
                     clippyAgent.play('GestureRight');
                     clippyAgent.moveTo(window.innerWidth-150, window.innerHeight-150);
                 } else if("Incorrect Password"){
                     var passwordBoxLocation = document.getElementsByName("password")[0].getBoundingClientRect();
                     clippyAgent.moveTo(passwordBoxLocation.right+10, parseInt((passwordBoxLocation.bottom+passwordBoxLocation.top)/2-40));
                     clippyAgent.speak(`Error! ${data.content}`);
                     clippyAgent.play('GestureRight');
                     clippyAgent.moveTo(window.innerWidth-150, window.innerHeight-150);
                 } else {
                     clippyAgent.speak(`Error! ${data.content}`);
                 }
             } else {
                 $.notify("Error: "+data.content, "error");
             }
         }
     } else {
         return console.log(`${data.event} is invalid for types of event`);
     }
 }
 function toggleSidebar(){
     if(!sideBarOpen){
         sideBarOpen = true;
         var sideBar = document.getElementById("sidebar");
         sideBar.style.width = "200px";
         var links = document.getElementsByClassName('link');
         for (var i = 0; i < links.length; i++) {
         links[i].style.visibility = 'visible';
         }
         document.getElementById("main").style.marginLeft = "200px";
     } else {
         sideBarOpen = false;
         document.getElementById("sidebar").style.width = "50px";
         document.getElementById("main").style.marginLeft= "50px";
         var links = document.getElementsByClassName('link');
         for (var i = 0; i < links.length; i++) {
         links[i].style.visibility = 'hidden';
         }
     }
 }
 function init(){
     websocket = new WebSocket("ws://localhost:8081");
     websocket.onopen = function(evt) { addToLog(`Connected!`, false) };
     websocket.onclose = function(evt) { addToLog(`Disconnected from websocket :( Try refreshing the webpage`, true) };
     websocket.onmessage = function(evt) { messageRecieved(evt.data) };
     websocket.onerror = function(evt) { addToLog(`Error: ${evt.data}`, true) };
     clippy.load('Clippy', (agent) => {
         agent.show();
         clippyAgent = agent;
         clippyAgent.interval = setInterval(() => {
             clippyAgent.animate();
         }, 10000);
     });
 }
 function logOut(){

}
 function showSettingsOverlay(){
     document.getElementById("settingsOverlay").style.display = "block";
     sideBarOpen = true;
     toggleSidebar();
     var dropZone = document.getElementById('fileDropArea');
     dropZone.addEventListener('dragover', handleDragOverForDeckUpload, false);
     dropZone.addEventListener('drop', handleDeckSelect, false);
 }
 function hideSettingsOverlay(){
     document.getElementById("settingsOverlay").style.display = "none";
 }
 function changePassword(){
     let password = document.getElementById("newPassword").value;
     let confirmPassword = document.getElementById("newPasswordConfirm").value;
     if(password.length < 6){
         return $("#settingsInner").notify("Your Password Needs To Be Over 6 Characters!", {className: "warn", position: "top right"});    
     } else if(!(/\d/.test(password))){
         return $("#settingsInner").notify("You Need To Have At Least One Number!", {className: "warn", position: "top right"});                
     } else if(password != confirmPassword){
         return $("#settingsInner").notify("Both Passwords Need To Match!", {className: "warn", position: "top right"});  
     }
     websocket.send(JSON.stringify({"action": "update", "request": "change password", "password": password}));
     document.getElementById("newPassword").value = "";
     document.getElementById("newPasswordConfirm").value = "";
 }
 function changeEmail(){
     let email = document.getElementById("newEmail").value;
     let confirmEmail = document.getElementById("newEmailConfirm").value;
     if(!validateEmail(email))  return $("#settingsInner").notify("Invalid email address!", {className: "warn", position: "top right"});
     if(email != confirmEmail)  return $("#settingsInner").notify("Both emails needs to match!", {className: "warn", position: "top right"});
     websocket.send(JSON.stringify({"action": "update", "request": "change email", "email": email}));
     document.getElementById("newEmail").value = "";
     document.getElementById("newEmailConfirm").value = "";
 }
 function validateEmail(email){ // Function copied from the server side
     if(email.length <= 0 || email.length > 60) return false;
     if(email.indexOf('@') < 1 || email.indexOf('@') >= email.indexOf('@') + email.indexOf('.')) return false;
     if(email.split('@').length != 2 || email.split('@')[1].split('.')[0].length < 1 || email.split('@')[1].split('.')[1].length < 1) return false;
     return true;
 }
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
 
 // Game
 function allowSelectingCardsForCzar() {
     let submittedCardsContainers = document.getElementsByClassName("submittedCardsContainer");
     for(var i=0; i < submittedCardsContainers.length;i++){
         submittedCardsContainers[i].style.cursor = "pointer";
         let cardsInContainer = submittedCardsContainers[i].children;
         for(var j=0; j < cardsInContainer.length; j++){
             cardsInContainer[j].style.cursor = "pointer";
         }
     }
 }
 function selectCardForCzar(container) {
     if(gameData.status != "choosing winner") return;
     if(gameData.winner != "") return;
     if(confirm("Are you sure this is your choice?")){
         let submittedCardsContainers = document.getElementsByClassName("submittedCardsContainer");
         let index = 0;//submittedCardsContainers.findIndex(oContainer => container == oContainer);
         for(var i=0;i<submittedCardsContainers.length;i++){
             if(submittedCardsContainers[i] == container){
                 index = i;
                 i = submittedCardsContainers.length;
             }
         }
         submitWinner(gameData["cards chosen"][index].cards);
         console.log("[\"cards chosen\"]:"+JSON.stringify(["cards chosen"]));
     }
 }
 function submitWinner(cards){
     console.log("Cards sent to submit winner: "+JSON.stringify(cards));
     // {"cards":[{"card text":"Prison rape.","card ID":6574}]}
     websocket.send(JSON.stringify({"action": "game", "request": "choose winner", "cardID": cards[0]["card ID"]}));
 }
 function showPlayersInGame(start, winner){
     var playerListElement = start ? document.getElementById("playerListStartScreen") : document.getElementById("playerList");
     var playerList = (playerListElement.contentWindow || playerListElement.contentDocument);
     let intervalChange = setInterval(() => {
         if(playerList.showPlayers){
             playerList.showPlayers(gameData.players, !start, winner, gameData.host, gameData.czar, username);
             clearInterval(intervalChange);
         }
     }, playerList.showPlayers ? 0 : 10);
     /*
     if(playerList.ready || playerList.innerHTML != null){
         console.log(`running showPlayers with data ${JSON.stringify(gameData.players)} and ${!start}`);
         playerList.showPlayers(gameData.players, !start);
     } else {
         console.log('readystate not complete');
         playerListElement.onload = function(){
             playerList.ready = true;
             console.log(`running showPlayers delayed with data ${JSON.stringify(gameData.players)} and ${!start}`);
             playerList.showPlayers(gameData.players, !start);
         }
     }*/
     
 }
 function updateDecksAvailable(){
     let host = username == gameData.host;
     let decksDOMelement = document.getElementById("decksAvailable");
     if(!decksDOMelement) return;
     let decksAvailableIframeContent = (decksDOMelement.contentWindow || decksDOMelement.contentDocument);
     let intervalChange = setInterval(() => {
         if(decksAvailableIframeContent.updateContent){
             host ? decksAvailableIframeContent.updateContent(gameData["decks available"], host) : decksAvailableIframeContent.updateContent(gameData["decks added"], host); 
             clearInterval(intervalChange);
         }
     }, decksAvailableIframeContent.updateContent ? 0 : 10);
     
 }
 function manageDecks(deckIndex, use){
     console.log(`Deck ${deckIndex} ${use}`);
     //{"action": "game", "request": "add deck", "deckID": 2}
     websocket.send(JSON.stringify({"action": "game", "request": use ? "add deck" : "remove deck", "deckID": gameData["decks available"][deckIndex].deckID}));
 }
 function showStartOverlay(){
     document.getElementById("overlay").style.display = "block";
     let controls = document.getElementsByClassName("hostControls");
     for(var i=0;i<controls.length;i++){
         controls[i].style.display = gameData.host == username ? "inline" : "none";
     }
 }
 function hideStartOverlay(){
     document.getElementById("overlay").style.display = "none";
 }
 function showBlackCard(){
     if(!gameData["black card"]) return;
     var blackCardArea = document.getElementById("blackCardArea");
     blackCardArea.innerHTML = `<div class="card black" id="blackCard">${gameData["black card"].text}<hr>Pick: ${gameData["black card"]["cards to pick"]}</div>`;
 }
 function showCardsChosen(showWinner){
     var submittedCardsArea = document.getElementById("submittedCardsArea");
     submittedCardsArea.innerHTML = "";
     gameData["cards chosen"].forEach(obj => {
         var container = document.createElement("div");
         container.classList.add("submittedCardsContainer");
         container.setAttribute("name", gameData["cards chosen"].findIndex(cards => obj == cards));
         if(gameData.czar == username && !showWinner && gameData.winner == ""){
             container.setAttribute("onClick", "selectCardForCzar(this)");
             container.classList.add("click");
         } else {
             container.classList.add("noClick");
         }
         if(gameData.winner == obj.username){
             container.classList.add("winner");
         }
         for(var i = 0; i < obj.cards.length; i++){
             var card = document.createElement("div");
             card.classList.add("card", "white", "submittedWhiteCard", "shadow");
             if(gameData.czar == username && !showWinner && gameData.winner == "") card.classList.add("click");
             card.innerText = obj.cards[i]["card text"];
             container.appendChild(card);
         }
         submittedCardsArea.appendChild(container);
     });
     /* <div class="submittedCardsContainer"><div class="card white submittedWhiteCard shadow">example text reee</div><div class="card white submittedWhiteCard shadow">example text reee</div></div> */
 }
 function showOwnedCards(){
     var cardArea = document.getElementById("ownedCardsArea");
     for(var i=0;i < selectedCards.length;i++){
         selectedCards[i] = selectedCards[i].innerText;
     }
     cardArea.innerHTML = "";
     let czar = username == gameData.czar;
     selectedCards = [];
     if(gameData["cards in hand"]){
         gameData["cards in hand"].forEach((card) => {
             let cardDivDOM = document.createElement("div");
             cardDivDOM.classList.add("card", "white", "shadow");
             if(czar) cardDivDOM.classList.add("noClick");
             cardDivDOM.setAttribute("onClick", "selectCard(this)");
             cardDivDOM.innerText = card.text;
             cardArea.appendChild(cardDivDOM);
             if(selectedCards[selectedCards.length-1] == card.text){
                 cardDivDOM.classList.add("selected");
                 var submitButton = document.createElement("input");
                 submitButton.id = "submitCardsButton";
                 submitButton.className = "submitButton";
                 submitButton.setAttribute("type", "submit");
                 submitButton.setAttribute("value", "Submit Card");
                 submitButton.addEventListener("click", function(){
                     var cardsToSend = [];
                     for(var i=0; i < selectedCards.length; i++){
                         cardsToSend.push(gameData["cards in hand"].findIndex(cardOBJ => cardOBJ.text == selectedCards[i].innerText));
                     }
                     submitCards(cardsToSend);
                 });
                 cardDivDOM.appendChild(submitButton);
                 selectedCards[selectedCards.length-1] = cardDivDOM;
             } else if(selectedCards.find(text => text == card.text)){
                 cardDivDOM.classList.add("selected");
                 selectedCards[selectedCards.findIndex(text => text == card.text)] = cardDivDOM;
             }
             //cardArea.innerHTML += `<div class='card white shadow ${czar ? "noClick" : ""}' onClick='selectCard(this)'>${card.text}</div>`;
             // card.text
         });
     }
 }
 function selectCard(card){
     if(gameData.czar == username) return;
     if(cardsSent) return;
     if(selectedCards.find(sCard => sCard == card)){
         selectedCards = selectedCards.filter(sCard => sCard != card);
         card.classList.remove("selected");
         if(document.getElementById("submitCardsButton")){
             card.removeChild(document.getElementById("submitCardsButton"));
         }
     } else {
         if(gameData["black card"]["cards to pick"] > selectedCards.length){
             selectedCards.push(card);
             card.classList.add("selected");
             if(gameData["black card"]["cards to pick"] == selectedCards.length){
                 var submitButton = document.createElement("input");
                 submitButton.id = "submitCardsButton";
                 submitButton.className = "submitButton";
                 submitButton.setAttribute("type", "submit");
                 submitButton.setAttribute("value", "Submit Card");
                 console.log("displayed!");
                 submitButton.addEventListener("click", function(){
                     console.log("clicked!");
                     var cardsToSend = [];
                     for(var i=0; i < selectedCards.length; i++){
                         cardsToSend.push(gameData["cards in hand"].findIndex(cardOBJ => cardOBJ.text == selectedCards[i].innerText));
                     }
                     submitCards(cardsToSend);
                 });
                 card.appendChild(submitButton);
             }
         } else {
             $.notify("You Have Selected The Maximum Amount Of Cards You Can For This Black Card", "warn");
         }
     }
 }
 function submitCards(cards){
     console.log(`Cards Array: ${cards}`);
     if(cardsSent) return $.notify("You Have Already Submitted Your Cards!", "error");
     /* {"action": "game", "request": "submit cards", "cards": [0]} */
     var request = {
         "action": "game",
         "request": "submit cards",
         "cards": cards
     };
     websocket.send(JSON.stringify(request));
     cardsSent = true;
 }
 function updateGameDisplay(){ // Not running when someone joins? hmm
     console.log("running updateGameDisplay");
     showPlayersInGame(); 
     showOwnedCards();
     showBlackCard();
     showCardsChosen();
     updateInfoBox();
 }
 function updateInfoBox(){
     let infoBox = document.getElementById("infoBox");
     if(infoBox){
         if(gameData.status == "finished" || gameData.status == "setup"){
             infoBox.style.display = "none";
         } else {
             infoBox.style.display = "block";
         }
         infoBox.innerHTML = `<u>Stage: </u>${gameData.status}<br><u>Seconds Remaining In The Stage:</u>${(Math.round(Math.abs(Date.now()-gameData["stage ending time"])/1000))}<br><u>Round:</u> ${gameData.round}/${gameData.rounds}`;
         if(infoBox.timerInterval) clearInterval(infoBox.timerInterval);
         infoBox.timerInterval = setInterval(() => {
             infoBox.innerHTML = `<u>Stage: </u>${gameData.status}<br><u>Seconds Remaining In The Stage:</u>${(Math.round(Math.abs(Date.now()-gameData["stage ending time"])/1000))}<br><u>Round:</u> ${gameData.round}/${gameData.rounds}`;
             if(gameData["stage ending time"] < Date.now()) clearInterval(infoBox.timerInterval);
         }, 1000);
         // update it
     } else {
         // create it
         infoBox = document.createElement("div");
         infoBox.setAttribute("id", "infoBox");
         infoBox.innerHTML = `<u>Stage: </u>${gameData.status}<br><u>Seconds Remaining In The Stage:</u>${(Math.round(Math.abs(Date.now()-gameData["stage ending time"])/1000))}<br><u>Round:</u> ${gameData.round}/${gameData.rounds}`;
         if(infoBox.timerInterval) clearInterval(infoBox.timerInterval);
         infoBox.timerInterval = setInterval(() => {
             infoBox.innerHTML = `<u>Stage: </u>${gameData.status}<br><u>Seconds Remaining In The Stage:</u>${(Math.round(Math.abs(Date.now()-gameData["stage ending time"])/1000))}<br><u>Round:</u> ${gameData.round}/${gameData.rounds}`;
             if(gameData["stage ending time"] < Date.now()) clearInterval(infoBox.timerInterval);
         }, 1000);
         //$(infoBox).draggable();
         dragElement(infoBox);
         document.body.appendChild(infoBox);
     }
 }
 function updateOverlay(){
     updateDecksAvailable();
     showPlayersInGame(true);
     showStartOverlay();
     updateInfoBox();
 }
 function startGame(){
     if(gameData.players.length < 3) return $.notify("You need to have more than two players in the game!", "warn");
     websocket.send('{"action": "game", "request": "start game"}');
 }
 function leaveGame(){
     var request = {
         "action": "game",
         "request": "leave game"
     };
     websocket.send(JSON.stringify(request));
 }
 function sendMessage(){
     var messageBox = document.getElementById("messageBox");
     var message = messageBox.value;
     messageBox.value = "";
     websocket.send(JSON.stringify({"action": "game", "request": "message", "content": message}));
 }

 //Home Page
 function showHomePage(){
     page = "home";
     var xhttp = new XMLHttpRequest();
     xhttp.onreadystatechange = function() {
         if (this.readyState == 4 && this.status == 200) { // This runs when the web page has loaded
             document.body.innerHTML = this.responseText;
             clearInterval(changeQuoteInterval);
             showGamesRunning();
             sideBarOpen = true;
             toggleSidebar();
             // Need to do more to this
         } else if(this.status != 200 && this.readyState == 4){
             console.log(`Show homepage error, request failed with code ${this.status}`);
         }
     };
     xhttp.open("GET", "homePage.html", true);
     xhttp.send();
 }
 function showGamesRunning(){
     var gamesDisplayed = document.getElementById("gamesDisplayed");
     if(!gamesDisplayed) return;
     if(gamesRunning != 0){
         gamesDisplayed.innerHTML = "<ul>";
         gamesRunning.forEach((game) => {
             var toAdd = "<li class='gameBox'><table class='disable-select gameBoxShadow'>";
             toAdd += `<tr><th>Name: </th><th>${game.name}</th></tr>`;
             toAdd += `<tr><td>Players: </td><td>${game.players}</td></tr>`;
             toAdd += `<tr><td>Host: </td><td>${game.host}</td></tr>`;
             toAdd += `<tr><td>Private: </td><td>${game.private ? "Yes" : "No"}</td></tr>`;
             toAdd += `<tr><td>Round: </td><td>${game.round} / ${game.rounds}</td></tr>`;
             toAdd += `<tr><td>Decks Added: </td><td>${game["decks added"].length}</td></tr>`;
             toAdd += "</table>";
             toAdd += `<br><span class='joinGameButton gameBoxShadow disable-select' onClick='joinGame("${game.name}")'>Join Game</span>`;
             toAdd += "</li>";
             gamesDisplayed.innerHTML += toAdd;
         });
         gamesDisplayed.innerHTML += "</ul>";
     } else {
         gamesDisplayed.innerHTML = "<div id='noGames'>There are no games currently running!</div>";
     }
 }
 function joinGame(name){
     var message = {
             "action": "game",
             "request": "join game", 
             "game name": name
     };
     if(gamesRunning.find(game => game.name == name).private){
         message.password = window.prompt("Please Enter The Password For This Game");
         websocket.send(JSON.stringify(message));
     } else {
         websocket.send(JSON.stringify(message));
     }
 }
 function showGamePage(){
     var xhttp = new XMLHttpRequest();
     xhttp.onreadystatechange = function() {
         if (this.readyState == 4 && this.status == 200) { // This runs when the web page has loaded
             document.body.innerHTML = this.responseText;
             cardsSent = false;
             sideBarOpen = true;
             toggleSidebar();
             if(gameData.status == "setup" || gameData.status == "finished"){
                 showStartOverlay();
                 updateDecksAvailable();
                 showPlayersInGame(true);
             } else {
                 hideStartOverlay();
                 updateGameDisplay();
             }
             
         } else if(this.status != 200 && this.readyState == 4){
             console.log(`Show gamepage error, request failed with code ${this.status}`);
         }
     };
     xhttp.open("GET", "gamePage.html", true);
     xhttp.send();
 }
 function createGame(name){
     name = name.trim();
     if(!(name.length > 5 && name.length < 25)) return $.notify("Error: game name must be over 5 characters and under 25", "error");
     var request = {
         "action": "get container",
         "request": "create game",
         "game name": name
     };
     var password = document.getElementById("privateGameCheckbox").checked;
     if(password){
         request.password = "";
         while(request.password.length < 3 || request.password.length > 30){
             request.password = prompt("Please Enter The Game Password, Between 3 and 30 characters");
         }
     }
     websocket.send(JSON.stringify(request));
 }


 // External functions
 
 // Source of "dragElement" https://www.w3schools.com/howto/tryit.asp?filename=tryhow_js_draggable
 function dragElement(elmnt) {
     var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
     if (document.getElementById(elmnt.id + "header")) {
         /* if present, the header is where you move the DIV from:*/
         document.getElementById(elmnt.id + "header").onmousedown = dragMouseDown;
     } else {
         /* otherwise, move the DIV from anywhere inside the DIV:*/
         elmnt.onmousedown = dragMouseDown;
     }

     function dragMouseDown(e) {
         e = e || window.event;
         e.preventDefault();
         // get the mouse cursor position at startup:
         pos3 = e.clientX;
         pos4 = e.clientY;
         document.onmouseup = closeDragElement;
         // call a function whenever the cursor moves:
         document.onmousemove = elementDrag;
     }

     function elementDrag(e) {
         e = e || window.event;
         e.preventDefault();
         // calculate the new cursor position:
         pos1 = pos3 - e.clientX;
         pos2 = pos4 - e.clientY;
         pos3 = e.clientX;
         pos4 = e.clientY;
         // set the element's new position:
         elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
         elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
     }

     function closeDragElement() {
         /* stop moving when mouse button is released:*/
         document.onmouseup = null;
         document.onmousemove = null;
     }
 }