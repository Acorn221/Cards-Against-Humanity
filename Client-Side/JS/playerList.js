 // playerList.showPlayers(gameData.players, !start, winner, gameData.host, gameData.czar);
 function showPlayers(players, showScore, winner, host, czar, clientUsername){
    var list = document.getElementById("playersList");
    list.innerHTML = "";
    players.forEach((player) => {
        var newPlayer = document.createElement('div');
        newPlayer.classList.add("player");
        if(player.username == winner) {
            newPlayer.classList.add("winner");
        }
        if(player.username == czar && showScore) {
            newPlayer.classList.add("czar");
        }
        if(player.username == clientUsername) newPlayer.classList.add("clientPlayer");
        newPlayer.innerHTML = `${player.username == host ? "<u>Host</u><br>" : ""}<u>Name:</u> ${player.username}${showScore ? `<br><u>Score:</u> ${player.score}` : ""}`;
        list.appendChild(newPlayer);
    });
        
}