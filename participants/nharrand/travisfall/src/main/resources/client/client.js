(function() {
    var requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
    window.requestAnimationFrame = requestAnimationFrame;
})();

//Establish the WebSocket connection and set up event handlers
var webSocket = new WebSocket("ws://" + location.hostname + ":" + location.port + "/game/");
    webSocket.onmessage = function (msg) { events.push(msg) };
    webSocket.onclose = function () { alert("WebSocket connection closed") };



var canvas = document.getElementById("canvas"),
    ctx = canvas.getContext("2d"),
    players = new Map(),
    keys = [],
    boxes = [],
    ephemerals = [],
    events = [];

const fps = 30;
const interval = 1000/fps;

var width = 1400,
    height = 800,
    friction = 0.90,
    wallBump = 4,
    airFriction = 0.95,
    maxDx = 8,
    maxSlidingDy = 8,
    maxDy = 20,
    wallJumpTolerance = 2,
    myId = 0,
    canJump = false,
    doJump = false,
    right = false,
    alive = false,
    power_cd = 3*fps,
    power_cd_max = 3*fps,
    power_type = 0,
    timestamp = 0;


canvas.width = width;
canvas.height = height;

function trajectoryChange() {
    webSocket.send(JSON.stringify({
      t: 0,
      playerId: myId,
      timestamp: timestamp,
      x: players.get(myId).x,
      y: players.get(myId).y,
      dx: players.get(myId).dx,
      dy: players.get(myId).dy
    }));
}

function iamDead() {
    webSocket.send(JSON.stringify({
      t: 3,
      playerId: myId,
      timestamp: timestamp,
      x: players.get(myId).x,
      y: players.get(myId).y,
      color1: players.get(myId).color1,
      color2: players.get(myId).color2,
      h: players.get(myId).h,
      w: players.get(myId).w
    }));
}

function getColor(raw) {
    return "#"+ ('000000' + ((raw)>>>0).toString(16)).slice(-6);
}

function log(txt) {
    let logDiv = document.getElementById('log');
    logDiv.innerText += txt + "\n";
    logDiv.scrollTop = logDiv.scrollHeight;
}

function parseEvent(msg) {
   let event = JSON.parse(msg.data);

    if(event.t == 0) {
        let player = players.get(event.playerId);
        //TrajectoryChangeMessageType
        player.x = event.x;
        player.y = event.y;
        player.dx = event.dx;
        player.dy = event.dy;

    } else if (event.t == 1) {
        //log("box");
        //NewBlockMessageType
        boxes[event.boxId] = {
            boxId: event.boxId,
            x: event.x,
            y: event.y,
            w: event.w,
            h: event.h,
            gravity: event.gravity,
            dx: event.dx,
            dy: event.dy,
            color: getColor(event.color),
            type: event.type,
            ttl: -1,
            dead: false
        };
    } else if (event.t == 2) {
        //NewPlayerMessageType
        players.set(event.playerId, {
            id: event.playerId,
            x: event.x,
            y: event.y,
            w: event.w,
            h: event.h,
            jump: event.jump,
            speed: event.speed,
            gravity: event.gravity,
            dx: event.dx,
            dy: event.dy,
            color1: getColor(event.color1),
            color2: getColor(event.color2),
            score: event.score,
            dead: false
        });
        if(myId == event.playerId) {
            let colTd = document.getElementById('colors');
            colTd.style["background-color"] = players.get(myId).color1;
            colTd.style["color"] = players.get(myId).color2;
            let gameOver = document.getElementById('go');
            gameOver.innerHTML = "";
        }
        updateRanks(Array.from(players.values()));
    } else if (event.t == 3) {
        players.get(event.playerId).dead = true;
        updateRanks(Array.from(players.values()));
        //log("Player " + event.playerId + " died");
        if(event.playerId == myId) {
            alive = false;
            let bo = document.body;
            bo.style["background-color"] = "#660000";
            let gameOver = document.getElementById('go');
            gameOver.innerHTML = "<b>GAME OVER</b>";
            //webSocket.close();
            //PlayerDeathMessageType
            //updateRanks();
            /*alert("      GAME OVER!\n" +
            "    ----------------------\n" +
            "Refresh to play again.")*/

        }
    } else if (event.t == 4) {
        //IdAssignementMessage
        myId = event.playerId;
        alive = true;
        let bo = document.body;
        bo.style["background-color"] = "#222222";
        if (players.has(myId)) {
            let colTd = document.getElementById('colors');
            colTd.style["background-color"] = players.get(myId).color1;
            colTd.style["color"] = players.get(myId).color2;
            let gameOver = document.getElementById('go');
            gameOver.innerHTML = "";
        }

    } else if (event.t == 5) {
        //DeleteBoxMessage
        boxes[event.boxId].dead = true;
    } else if (event.t == 6) {
         //EphemeralMessage
         createEphemeralFromMsg(event, ephemerals, players);
     }
}

var now;
var then = Date.now();
var delta;

function update() {
    requestAnimationFrame(update);
    for(i in events) {
        let e = events.pop();
        parseEvent(e);
    }

    now = Date.now();
    delta = now - then;

    if (delta > interval) {
        then = now - (delta % interval);

        //check for collisions
        physic();

        //draw elements (boxes, item, players)
        drawElements();

        //check for keys
        processInputs();

        updatePowerCd();

        if(timestamp % 3*fps == 0) {
            updateRanks(Array.from(players.values()));
        }
        cleanUp();

        timestamp++;
    }
}

function cleanUp() {
    for (let i of players.keys()) {
        if (players.get(i).dead) {
            players.delete(i);
        }
    }
    for (i in boxes) {
        let box = boxes[i];
        if(box.ttl > 0) {
            box.ttl--;
        } else if (box.ttl == 0) {
            delete boxes[i];
        }
        if (boxes[i].dead) {
            delete boxes[i];
        }
    }
    for (i in ephemerals) {
        let eph = ephemerals[i];
        if (eph.toRemove) {
            delete ephemerals[i];
        }
    }
}

function processInputs() {
    if(alive) {
        let myPlayer = players.get(myId);
        //Jump
        if(doJump) {
            myPlayer.dy = -myPlayer.jump;
            if(!myPlayer.grounded && myPlayer.sliding_left) {
                myPlayer.dx = 3 * maxDx;
                myPlayer.x += 2;
            } else if (!myPlayer.grounded && myPlayer.sliding_right) {
                myPlayer.dx = -3 * maxDx;
                myPlayer.x -= 2;
            }
            trajectoryChange();
            //log("jump");
            doJump = false;
        }

        //left
        if(keys[37]){
            myPlayer.dx -= myPlayer.speed;
            trajectoryChange();
            right = false;
        }

        //right
        if(keys[39]){
            myPlayer.dx += myPlayer.speed;
            trajectoryChange();
            right = true;
        }

        //power
        if(keys[17]){
            power(myPlayer);
        }
    }
}

function physic() {
    if(alive) {
        if(players.get(myId).y > (height + 100)) {
            iamDead();
        }
    }

    for (i in ephemerals) {
        var eph = ephemerals[i];
        if(eph.contact(eph, players.get(myId), players)) {
            eph.apply(players.get(myId));
        }
    }

    for (i in boxes) {
        var box = boxes[i];
        box.y += box.gravity;
    }

    /*if(canJump > 0) {
        canJump--;
    }*/
    canJump = false;

    for (let player of players.values()) {
        player.score++;

        //Reset context
        player.grounded = false;
        player.sliding_left = false;
        player.sliding_right = false;

        //Gravity anticiptation (if collision, this effect will be nullified)
        player.dy += player.gravity;
        player.y += player.dy;


        //Collision detection
        for (j in boxes) {
            colCheck(player, boxes[j]);
            cj = contact(player, boxes[j]);

            player.grounded |= (cj == 'b');
            player.sliding_left |= (cj == 'l');
            player.sliding_right |= (cj == 'r');

            if(alive && player.playerId == myId) {
                if ((cj != '0' && cj != 't')) {
                    cj = contact(player, boxes[j]);
                    canJump |= (cj != '0' && cj != 't');
                }
            }
        }

        //Players movement
        if(player.grounded) {
            player.dx *= friction;
        } else {
            player.dx *= airFriction;
        }

        //Cap vertical speed
        if(player.sliding_left || player.sliding_right) {
            if(player.dy > maxSlidingDy) {
                player.dy = maxSlidingDy;
            }
        } else {
            if(player.dy > maxDy) {
                player.dy = maxDy;
            } else if(player.dy < -maxDy) {
                player.dy = -maxDy;
            }
        }

        //Cap horizontal speed
        if(player.dx > maxDx) {
            player.dx = maxDx;
        } else if(player.dx < -maxDx) {
            player.dx = -maxDx;
        }

        //Apply movement
        player.x += player.dx;
    }
}

function colCheck(player, obj) {
    // get the vectors to check against
    let vX = (player.x + (player.w / 2)) - (obj.x + (obj.w / 2)),
        vY = (player.y + (player.h / 2)) - (obj.y + (obj.h / 2)),
        // add the half widths and half heights of the objects
        hWidths = (player.w / 2) + (obj.w / 2),
        hHeights = (player.h / 2) + (obj.h / 2),
        col = '0';

    // if the x and y vector are less than the half width or half height, they we must be inside the object, causing a collision
    if (Math.abs(vX) < hWidths && Math.abs(vY) < hHeights) {
        if(obj.type == 2 && obj.ttl < 0) {
            obj.color = '#FF0000';
            obj.ttl = 15;
        }
        // figures out on which side we are colliding (top, bottom, left, or right)
        let oX = hWidths - Math.abs(vX),
            oY = hHeights - Math.abs(vY);
        if (oX >= oY) {
            if (vY > 0) {
                col = 't';
                player.y += oY;
                player.dy = 1;
            } else {
                col = 'b';
                player.y -= oY;
                player.dy = 0;
            }
        } else {
            if (vX > 0) {
                col = 'l';
                player.dx = 0;
                player.x += oX;
            } else {
                col = 'r';
                player.dx = 0;
                player.x -= oX;
            }
        }
    }
    return col;
}

function contact(player, obj) {
     // get the vectors to check against
     let vX = (player.x + (player.w / 2)) - (obj.x + (obj.w / 2)),
         vY = (player.y + (player.h / 2)) - (obj.y + (obj.h / 2)),
         // add the half widths and half heights of the objects
         hWidths = (player.w / 2) + (obj.w / 2) + 2,
         hHeights = (player.h / 2) + (obj.h / 2) + 2,
         col = '0';

     // if the x and y vector are less than the half width or half height, they we must be inside the object, causing a collision
     if (Math.abs(vX) < hWidths && Math.abs(vY) < hHeights) {
         // figures out on which side we are colliding (top, bottom, left, or right)
         let oX = hWidths - Math.abs(vX),
             oY = hHeights - Math.abs(vY);
         if (oX >= oY) {
             if (vY > 0) {
                 col = 't';
             } else {
                 col = 'b';
             }
         } else {
             if (vX > 0) {
                 col = 'l';
             } else {
                 col = 'r';
             }
         }
     }
     return col;
 }

function drawElements() {
    //Reset canvas
    ctx.clearRect(0, 0, width, height);

    //Ephemerals
    for (i in ephemerals) {
        let eph = ephemerals[i];
        //rayDraw(eph, ctx, width, players);
        eph.draw(eph, ctx, width, players);
    }

    //Boxes
    for (i in boxes) {
        let box = boxes[i];
        ctx.fillStyle = box.color;
        ctx.fillRect(box.x, box.y, box.w, box.h);
    }

    //Players
    for (let player of players.values()) {
        //Player's shadow
        ctx.fillStyle = player.color1;
        let smooth_dy = player.dy;
        if(Math.abs(smooth_dy) < 2*player.gravity) {
            smooth_dy = 0;
        }
        ctx.fillRect(
            player.x - (player.dx / 3) * 4 - 4,
            player.y - (smooth_dy / 3) * 4 - 4,
            player.w + 8,
            player.h + 8
        );

        //Player's body
        ctx.fillStyle = player.color2;
        ctx.fillRect(player.x, player.y, player.w, player.h);
    }
}

function power(player) {
    if(power_cd == power_cd_max) {
        /*ephemerals.push({
            type: 0,
            playerId: player.id,
            x: player.x,
            y: player.y,
            maxSize: 12,
            curSize: 0,
            step: 5,
            right: right,
            up: true,
            color: '#0000FF',
            toRemove: false
        });*/
        ephemerals.push(rayCreate(player, webSocket));
        power_cd = 0;
    }
}

//Keep track of keys
document.body.addEventListener("keydown", function(e) {
    //Disallow perma jump
    if((e.keyCode == 32 || e.keyCode == 38) && !keys[e.keyCode]
    && (players.get(myId).sliding_right || players.get(myId).sliding_left || players.get(myId).grounded)) {
        doJump = true;
    }
    keys[e.keyCode] = true;
});

document.body.addEventListener("keyup", function(e) {
    keys[e.keyCode] = false;
});

window.addEventListener("load", function() {
    update();
});

//Display scores
function updateRanks(playerList) {
    let copy = playerList;
    copy.sort(comparePlayer);
    let table = "<thead><td>Rank</td><td>Player</td></thead>";
    let i = 1;
    for (j in copy) {
        let player = copy[j];
        let score = Math.round(player.score/fps);
        table += "<tr><td>" + i + "</td>";
        table += "<td style=\"background-color: " + player.color1 + "; color: " + player.color2 +";\">&#x25a0;</td>";
        table += "<td>" + score + "</td></tr>";
        i++;
    }

    let rankTable = document.getElementById('ranktable');
    rankTable.innerHTML = table;

}

function comparePlayer( a, b ) {
  if ( a.score > b.score ){
    return -1;
  }
  if ( a.score < b.score ){
    return 1;
  }
  return 0;
}

function updatePowerCd() {
    if(power_cd < power_cd_max) {
        power_cd++;
        let progress = document.getElementById('cd');
        cd.setAttribute('max', power_cd_max);
        cd.setAttribute('value', power_cd);
    }
}