/*function showDecks(decks){
            var list = document.getElementById("deckList");
            list.innerHTML = "";
            decks.forEach((deck) => {
                var newdeck = document.createElement('div');
                newPlayer.className = "deck";
                newPlayer.innerHTML = `<u>Name:</u> best ever deck <br><u>White Card Count:</u> 2<br><u>Black Card Count:</u> 4<br><input type="checkbox" value="0"  onClick="manageDecks(this.value, this.checked)"> Use Deck`;
                list.appendChild(newPlayer);
            });
        }*/
        function updateContent(decks, host){
            if(!decks) return;
            var decksSelected = [];
            let list = document.getElementById("deckList");
            let boxesChecked = document.getElementsByTagName("input");
            let decksShown = document.getElementsByClassName("deck");
            for(var i=0; i < boxesChecked.length; i++){
                if(boxesChecked[i].checked) decksSelected.push(i);
            }
            //alert(JSON.stringify(decksSelected));
            list.innerHTML = "";
            for(var i = 0; i < decks.length; i++){
                let newDeck = document.createElement("div");
                newDeck.classList.add("deck");
                newDeck.innerHTML = `<u>Name:</u> ${decks[i].name}<br><u>White Card Count:</u> ${decks[i]["white card count"]}<br><u>Black Card Count:</u> ${decks[i]["black card count"]}<br><u>Private? </u> ${decks[i].private ? "Yes" : "No"}<br>`;
                if(host) newDeck.innerHTML += `<input type="checkbox" name="${i}" onClick="window.parent.manageDecks(this.name, this.checked)"></input>Use Deck`;
                // value="${decksSelected.includes(i) ? "1" : "2"}"
                if(decksSelected.includes(i)) newDeck.getElementsByTagName("input")[0].checked = true;
                //decksSelected.includes(i) ? alert("found box was checked! ") : alert("found box wasnt checked! ");
                // Mark the checked boxes as checked
                list.appendChild(newDeck);
            }
        }