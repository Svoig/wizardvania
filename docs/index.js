kaboom({
    global: true,
    fullscreen: true,
    scale: 1.25,
    debug: true,
    clearColor: [0, 0, 0, 1],
});

const BULLET_SPEED = 300;
const PLAYER_MOVE_SPEED = 125;
const PLAYER_BOOST_SPEED = 200;
const PLAYER_JUMP_FORCE = 250;
const TILE_UNIT = 10;
const GRAVITY = 980;
const GOBLIN_JUMP_FORCE = 200;

// Keys
const UP = "w";
const RIGHT = "d";
const DOWN = "s";
const LEFT = "a";
const SHOOT = "space";
const BOOST = "shift";

// Reusable components for creating things dynamically
const respawningExtraBoostComponents = [rect(5, 5), color( 1.0, 0,  1.0), "respawningExtraBoost"];

const mapTokenConfig = {
    width: TILE_UNIT,
    height: TILE_UNIT,
    pos: vec2(0, 0),
    "=": [rect(TILE_UNIT, TILE_UNIT), color(0.45, 0.1, 0.1), solid(), "terrain"], // Ground
    "#": [rect(TILE_UNIT, TILE_UNIT), color(1.0, 0.75, 0), solid(), "terrain", "lava", "hurt"], // Lava
    "o": [rect(5, 5), color( 1.0,  1.0, 0), "coin"], // Coin
    "P": ["playerStart"], // Player start
    "^": [rect(5, 5), color(0,  1.0,  1.0), "extraBoost"], // Extra boost powerup
    "§": respawningExtraBoostComponents, // Respawning Extra Boost powerup,
    "S": [rect(5, 5), color(0.25, 0.75, 0.95), body(), { strength: 1, health: 1 }, "slime", "enemy"],// Slime
    "G": [rect(TILE_UNIT, TILE_UNIT), color(0,  1.0, 0), body({jumpForce: GOBLIN_JUMP_FORCE}), { strength: 1, health: 2 }, "goblin", "enemy"], // Goblin,
    "h": [rect(5, 5), color( 1.0, 0, 0.5), body(), { strength: 1 }, "minorHealthPotion", "healthPotion", "potion"], // Minor Health Potion
    "H": [rect(TILE_UNIT, TILE_UNIT), color( 1.0, 0, 0.5), body(), { strength: 3 }, "majorHealthPotion", "healthPotion", "potion"], // Major Health Potion
};

function addPlayer() {
    return add([
        rect(TILE_UNIT, TILE_UNIT),
        color( 1.0, 0, 0),
        pos(-1000, -1000), // Start offscreen. Let every("playerStart") put the player in the right place
        body(),
        {
            boostTarget: null,
            canBoost: true,
            canShoot: true,
            health: 3,
            maxHealth: 3,
            maxBoosts: 1,
            numBoosts: 1,
            strength: 1,
            tempBoosts: 0,
        }
    ]);
}

function sceneSetup(player) {

    const score = add([
        text(`Score: 0`, 16),
        color( 1.0,  1.0, 0),
        pos(10, 10),
        { value: 0 }
    ]);

    const boostText = add([
        text(getBoostIndicators(player), 16),
        color(0,  1.0,  1.0),
        pos(250, 10),
        { value: player.maxBoosts + player.tempBoosts }
    ]);

    const healthText = add([
        text(getPlayerHealth(player), 16),
        color( 1.0, 0, 0),
        pos(550, 10),
        { value: player.health }
    ]);

    every("enemy", (enemy) => {
        enemy.collides("PLAYER_BULLET", () => {
            enemy.health -= player.strength;
        })
    });

    action("enemy", (enemy) => {
        if (enemy.health <= 0) {
            destroy(enemy);
        }
    });

    every("goblin", (goblin) => {
        loop(1.25, () => {
            goblin.jump();
        });
    });

    action("goblin", (goblin) => {
        goblin.move(-50, 0);
    });

    action("slime", (slime) => {
        slime.move(-20, 0);
    });

    player.collides("hurt", () => {
        go("gameOver", { returnScene: "one" })
    });

    player.collides("enemy", (enemy) => {
        player.health -= enemy.strength;
        healthText.text = getPlayerHealth(player);
    })

    player.collides("boss", (boss) => {
        player.health -= boss.strength;
        healthText.text = getPlayerHealth(player);
    })

    player.collides("coin", (coin) => {
        destroy(coin);
        score.value++;
        score.text = `Score: ${score.value}`;
    });

    player.collides("healthPotion", (potion) => {
        destroy(potion);
        if (player.health + potion.strength < player.maxHealth) {
            player.health += potion.strength;
        } else {
            player.health = player.maxHealth;
        }
        healthText.text = getPlayerHealth(player);
    });

    player.collides("extraBoost", (extraBoost) => {
        destroy(extraBoost);
        player.tempBoosts++;
        boostText.text = getBoostIndicators(player);
    });

    player.collides("respawningExtraBoost", (respawningExtraBoost) => {
        const itemPos = respawningExtraBoost.pos;

        destroy(respawningExtraBoost);

        player.tempBoosts++;
        boostText.text = getBoostIndicators(player);

        wait(5, () => {
            add([...respawningExtraBoostComponents, pos(itemPos.x, itemPos.y)]);
        });
    });

    keyDown(SHOOT, () => {
        if (player.canShoot) {
            let bulletSpeedX = BULLET_SPEED;
            let bulletSpeedY = 0;

            const bullet = add([
                rect(5, 5),
                color( 1.0,  1.0, 100),
                pos(player.pos.x, player.pos.y),
                "PLAYER_BULLET"
            ]);

            bullet.collides("enemy", () => {
                destroy(bullet);
            });

            bullet.collides("terrain", () => {
                destroy(bullet);
            });

            if (keyIsDown(UP)) {
                bulletSpeedX = 0;
                bulletSpeedY = -BULLET_SPEED;
            } else if (keyIsDown(LEFT)) {
                bulletSpeedX = -BULLET_SPEED;
                bulletSpeedY = 0;
            } else if (keyIsDown(DOWN)) {
                bulletSpeedX = 0;
                bulletSpeedY = BULLET_SPEED;
            }

            bullet.action(() => {
                bullet.move(bulletSpeedX, bulletSpeedY);
            });

            player.canShoot = false;

            wait(0.25, () => {
                player.canShoot = true;
            });

            wait(1, () => {
                destroy(bullet);
            })
        }
    });

    keyDown(RIGHT, () => {
        // If they're boosting, ignore arrow keys
        if (!player.boostTarget) {
            player.move(PLAYER_MOVE_SPEED, 0);
        }
    });

    keyDown(LEFT, () => {
        // If they're boosting, ignore arrow keys
        if (!player.boostTarget) {
            player.move(-PLAYER_MOVE_SPEED, 0);
        }
    });

    keyPress(BOOST, () => {
        // if (player.canBoost) {
        if ((player.numBoosts + player.tempBoosts) > 0) {
            if (keyIsDown(RIGHT)) {
                if (keyIsDown(UP)) {
                    // If up and right are both pressed
                    // Divide Y boost by two because otherwise it seems too good
                    player.boostTarget = vec2(player.pos.x + PLAYER_BOOST_SPEED, player.pos.y - (PLAYER_BOOST_SPEED / 2));
                } else if (keyIsDown(DOWN)) {
                    // If down and right are both pressed
                    if (player.grounded()) {
                        // If grounded, just go right
                        player.boostTarget = vec2(player.pos.x + PLAYER_BOOST_SPEED, player.pos.y);
                    } else {
                        // Divide Y boost by two because otherwise it seems too good
                        player.boostTarget = vec2(player.pos.x + PLAYER_BOOST_SPEED, player.pos.y + (PLAYER_BOOST_SPEED / 2));
                    }
                } else {
                    // If just right is pressed
                    player.boostTarget = vec2(player.pos.x + PLAYER_BOOST_SPEED, player.pos.y);
                }
            } else if (keyIsDown(LEFT)) {
                if (keyIsDown(UP)) {
                    // If up and left are both pressed
                    // Divide Y boost by two because otherwise it seems too good
                    player.boostTarget = vec2(player.pos.x - PLAYER_BOOST_SPEED, player.pos.y - (PLAYER_BOOST_SPEED / 2));
                } else if (keyIsDown(DOWN)) {
                    // If down and left are both pressed
                    if (player.grounded()) {
                        // If grounded, just go left
                        player.boostTarget = vec2(player.pos.x - PLAYER_BOOST_SPEED, player.pos.y);
                    } else {
                        // Divide Y boost by two because otherwise it seems too good
                        player.boostTarget = vec2(player.pos.x - PLAYER_BOOST_SPEED, player.pos.y + (PLAYER_BOOST_SPEED / 2))
                    }
                } else {
                    // If just left is pressed
                    player.boostTarget = vec2(player.pos.x - PLAYER_BOOST_SPEED, player.pos.y);
                }
            } else if (keyIsDown(UP)) {
                // If just up is pressed
                // Dividing by two because otherwise it seems too good
                player.boostTarget = vec2(player.pos.x, player.pos.y - (PLAYER_BOOST_SPEED / 2));
            } else if (keyIsDown(DOWN) && !player.grounded()) {
                // If just down is pressed
                player.boostTarget = vec2(player.pos.x, player.pos.y + PLAYER_BOOST_SPEED);
            } else {
                // If NO KEYS are pressed, go right
                player.boostTarget = vec2(player.pos.x + PLAYER_BOOST_SPEED, player.pos.y);
            }
            // Disable ALL gravity when boosting
            gravity(0);
            // player.canBoost = false;
            if (player.numBoosts > 0) {
                player.numBoosts--;

                wait(1, () => {
                    // player.canBoost = true;
                    player.numBoosts++;
                    // Update the UI indicator of the number of boosts available
                    boostText.text = getBoostIndicators(player);
                });
            } else if (player.tempBoosts > 0) {
                player.tempBoosts--;
            }

            // Update the UI indicator of the number of boosts available
            boostText.text = getBoostIndicators(player);


            // Clear out boost target after .25s to avoid player getting pulled toward target forever
            wait(0.25, () => {
                gravity(GRAVITY);
                player.boostTarget = null;
            })
        }
    });

    player.action(() => {

        if (player.health <= 0) {
            go("gameOver", { returnScene: "one" });
        }

        if (player.boostTarget) {
            const distanceToTarget = Math.sqrt((player.boostTarget.x - player.pos.x) ** 2 + (player.boostTarget.y - player.pos.y) ** 2);

            // If player is already at target, set target to null and return early
            if (Math.round(distanceToTarget) === 0) {
                return player.boostTarget = null;
            }
            // Lerp 3 steps to boost target
            const nextPos = vec2(lerp(player.pos.x, player.boostTarget.x, 3), lerp(player.pos.y, player.boostTarget.y, 3));
            player.move(nextPos.x - player.pos.x, nextPos.y - player.pos.y);
        }
    });
}

function getPlayerHealth(player) {
    // Create a * character for each boost available
    let health = '';
    for (let i = 0; i < (player.health); i++) {
        health += '*';
    }

    return `Health: ${health}`;
}

/**
 * 
 * @param {object} player The player object. Needed for getting the number of available boosts
 * plus temporary boosts currently collected
 * @returns 
 */
function getBoostIndicators(player) {
    // Create a * character for each boost available
    let boostIndicators = '';
    for (let i = 0; i < (player.numBoosts + player.tempBoosts); i++) {
        boostIndicators += '*';
    }

    return `Boosts: ${boostIndicators}`;
}

scene("gameOver", ({ returnScene }) => {
    add([text("Game Over. Press ENTER to try again", 12), pos(width() / 2, height() / 2)]);

    keyPress(["enter", "space"], () => {
        go(returnScene);
    });
});

scene("one", () => {
    gravity(GRAVITY);
    const map = addLevel([
        "=                                                                                                                             ", "                                                                                                                              ",
        "=                                                                                                                             ",
        "=                                                                                                                             ",
        "=                                                                                                                             ",
        "=                                                                                                                             ",
        "=                                                                                                                             ",
        "=                                                                                                                             ",
        "=                                                                                                                             ",
        "=                                                                                                                             ",
        "=                                                                                                                             ",
        "=                                                                                                                             ", "                                                                                                                              ",
        "=                                                                                                                             ",
        "=                                                                                                                             ",
        "=                                                                                                                             ",
        "=                                                                                                                             ",
        "=                                                                                                                             ",
        "=                                                                                                                             ",
        "=                                                                                                                             ",
        "=                                                                                                                             ",
        "=                                                                                                                             ",
        "=                                                                                                                             ",
        "=                                                                                                                             ",
        "=                                                                                                                             ",
        "=                                                                                                                             ",
        "=                                               ooooooooooooooo                                                               ",
        "=                                               ooooooooooooooo                                                               ",
        "=                                               ooooooooooooooo                                                               ",
        "=                                               ===============                                                               ",
        "========                      ===                                                                                             ",
        "=                                                                                                                             ",
        "=                                            ===                                              H                               ",
        "=                 o                                                                     ===============                       ",
        "=                ===         ooo           ==                                                                                 ",
        "=                         ======                                                                                              ",
        "=                                                                            G                                                ",
        "=                 ^                                                        =====                                              ",
        "=      ==     ==========                                                                                                      ",
        "=                                                                                                                             ",
        "=                        ===                                                                                                  ",
        "=                                      oo                                                                                     ",
        "=                                     ====                                                                                    ",
        "=                                                      oo                                                                     ",
        "=                                      oooo           =====                                                                   ",
        "=                                     =======                                                                                 ",
        "=                                                                                                                             ",
        "=                         ooo G                                                                                               ",
        "=                       =======                                                                                               ",
        "=                                                                                                                             ",
        "=P   §                        S             h                                                                                 ",
        "=====================================================####====================================================================="
    ],
        mapTokenConfig
    );

    const player = addPlayer();

    sceneSetup(player);

    // Use the "playerStart" object from the map to set start position
    every("playerStart", (playerStart) => {
        player.pos.x = playerStart.pos.x;
        player.pos.y = playerStart.pos.y;
    });
});

scene("two", () => {
    const map = addLevel([
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              ",
        "                                                                                                                              "
    ],
        mapTokenConfig);

    const player = addPlayer();
});

start("one");
