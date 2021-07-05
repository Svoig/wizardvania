kaboom({
    global: true,
    fullscreen: true,
    scale: 1.25,
    debug: true,
    clearColor: [0, 0, 0, 1],
});

const FIRE = "fire";
const WATER = "water";
const EARTH = "earth";
const AIR = "air";

const ELEMENTS = [FIRE, WATER, EARTH, AIR];

/**
 * Choose a random element to be used to create different hazards, etc for each attempt at a level
 * @param {string} lastElement The element that was active in the level just played
 * @returns {string} The new element to be used in the level
 */
const getElement = (lastElement) => {
    // Filter out the last element so you never get a back-to-back repeat
    const filteredElements = ELEMENTS.filter(e => e !== lastElement);

    return choose(filteredElements);
}

const getHazardForElement = (element) => {
    switch (element) {
        case FIRE:
            return [rect(TILE_UNIT, TILE_UNIT), color(1.0, 0.75, 0), solid(), "terrain", "lava", "kill"]; // Lava
        case WATER:
            return [rect(TILE_UNIT, TILE_UNIT), color(0, 1, 1), solid(), "terrain", "ice"]; // Ice
        case EARTH:
            return [rect(TILE_UNIT, TILE_UNIT), color(0.25, 0.1, 0.1), solid(), "terrain", "crumblingBlock"]; // Crumbling block
        case AIR:
            return [rect(TILE_UNIT, TILE_UNIT), color(0, 0, 0, 0), "pit"]; // Empty pit
        default:
            return [rect(TILE_UNIT, TILE_UNIT), color(0, 0, 0, 0), "pit"]; // Empty pit
    }
}

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
const respawningExtraBoostComponents = [rect(5, 5), color(1.0, 0, 1.0), "respawningExtraBoost"];
const explosionComponents = [rect(TILE_UNIT, TILE_UNIT), color(1, 1, 1), origin("center"), "explosion"];

const mapTokenConfig = (element) => ({
    width: TILE_UNIT,
    height: TILE_UNIT,
    pos: vec2(0, 0),
    // End of level goal
    "*": [rect(TILE_UNIT / 2, TILE_UNIT / 2), origin("center"), "goal"],
    // Terrain & hazards
    "x": [rect(TILE_UNIT, TILE_UNIT), color(0, 0, 0, 0), "outOfBounds", "kill"], // Kill the player if they go out of bounds (like in a pit)
    "=": [rect(TILE_UNIT, TILE_UNIT), color(0.45, 0.1, 0.1), solid(), "terrain"], // Ground
    "#": getHazardForElement(element), // Elemental Hazard
    // Collectibles & powerups
    "o": [rect(5, 5), color(1.0, 1.0, 0), "coin"], // Coin
    "P": ["playerStart"], // Player start
    "^": [rect(5, 5), color(0, 1.0, 1.0), "extraBoost"], // Extra boost powerup
    "§": respawningExtraBoostComponents, // Respawning Extra Boost powerup,
    "h": [rect(5, 5), color(1.0, 0, 0.5), body(), { strength: 1 }, "minorHealthPotion", "healthPotion", "potion"], // Minor Health Potion
    "H": [rect(TILE_UNIT, TILE_UNIT), color(1.0, 0, 0.5), body(), { strength: 3 }, "majorHealthPotion", "healthPotion", "potion"], // Major Health Potion
    // Enemies
    "S": [rect(5, 5), color(0.25, 0.75, 0.95), body(), { strength: 1, health: 1 }, "slime", "enemy"],// Slime
    "G": [rect(TILE_UNIT, TILE_UNIT), color(0, 1.0, 0), body({ jumpForce: GOBLIN_JUMP_FORCE }), { strength: 1, health: 2 }, "goblin", "enemy"], // Goblin,
});

function addPlayer() {
    return add([
        rect(TILE_UNIT, TILE_UNIT),
        color(1.0, 0, 0),
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

function sceneSetup({ player, element, nextLevel }) {

    const score = add([
        text(`Score: 0`, 16),
        color(1.0, 1.0, 0),
        pos(10, 10),
        { value: 0 }
    ]);

    const boostText = add([
        text(getBoostIndicators(player), 16),
        color(0, 1.0, 1.0),
        pos(250, 10),
        { value: player.maxBoosts + player.tempBoosts }
    ]);

    const healthText = add([
        text(getPlayerHealth(player), 16),
        color(1.0, 0, 0),
        pos(550, 10),
        { value: player.health }
    ]);

    // every("goal", (goal) => {
    // let growOrShrink = 1;
    // goal.action(() => {
    //     goal.width += growOrShrink;
    //     goal.height += growOrShrink;

    //     if (goal.width < 2) {
    //         growOrShrink = 1;
    //     } else if (goal.width > 5) {
    //         growOrShrink = -1;
    //     }
    // });
    // });

    every("enemy", (enemy) => {
        enemy.collides("PLAYER_BULLET", () => {
            enemy.health -= player.strength;
        })
    });

    action("enemy", (enemy) => {
        enemy.collides("kill", () => {
            // TODO: Let fire enemies walk on lava
            destroy(enemy);
        });

        if (enemy.health <= 0) {
            destroy(enemy);
            const explosion = add([...explosionComponents, color(1.0, 0.5, 0), pos(enemy.pos.x, enemy.pos.y)]);
            explosion.action(() => {
                explosion.width++;
                explosion.height++;
            });
            wait(0.125, () => {
                destroy(explosion);
            });
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

    player.collides("goal", () => {
        go(nextLevel, { lastElement: element });
    });

    player.collides("kill", () => {
        // Insta-kill the player (for things like lava and spikes)
        go("gameOver", { returnScene: "one", lastElement: element });
    });

    player.collides("crumblingBlock", (crumblingBlock) => {
        // Shrink the block vertically to show that it's breaking, then destroy it
        action(() => crumblingBlock.height--);
        wait(0.25, () => {
            destroy(crumblingBlock);
        })
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

    player.on("grounded", () => {
        // If they boosted, give them their boost back when they hit the ground
        if (player.numBoosts < player.maxBoosts) {
            player.numBoosts++;
        }
        // Update the UI indicator of the number of boosts available
        boostText.text = getBoostIndicators(player);
    })

    keyDown(SHOOT, () => {
        if (player.canShoot) {
            let bulletSpeedX = BULLET_SPEED;
            let bulletSpeedY = 0;

            const bullet = add([
                rect(5, 5),
                color(1.0, 1.0, 100),
                pos(player.pos.x, player.pos.y),
                "PLAYER_BULLET"
            ]);

            bullet.collides("enemy", (enemy) => {
                destroy(bullet);
                const bulletHitIndicator = add([...explosionComponents, pos(bullet.pos.x, bullet.pos.y)]);
                bulletHitIndicator.action(() => {
                    bulletHitIndicator.width++;
                    bulletHitIndicator.height++;
                });
                wait(0.125, () => {
                    destroy(bulletHitIndicator);
                });
            });

            bullet.collides("terrain", () => {
                destroy(bullet);
                const bulletHitIndicator = add([...explosionComponents, pos(bullet.pos.x, bullet.pos.y)]);
                bulletHitIndicator.action(() => {
                    bulletHitIndicator.width++;
                    bulletHitIndicator.height++;
                });
                wait(0.125, () => {
                    destroy(bulletHitIndicator);
                });
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

scene("gameOver", ({ returnScene, lastElement }) => {
    add([text("Game Over. Press ENTER to try again", 12), pos(width() / 2, height() / 2)]);

    keyPress(["enter", "space"], () => {
        const newElement = getElement(lastElement);
        go(returnScene, { element: newElement });
    });
});

scene("one", () => {
    const nextLevel = "two";
    const element = getElement();
    gravity(GRAVITY);
    const map = addLevel([
        "==============================================================================================================================",
        "=                                                                                                                            =",
        "=                                                                                                                            =",
        "=                                                                                                                            =",
        "=                                                                                                                            =",
        "=                                                                                                                            =",
        "=                                                                                                                            =",
        "=                                                                                                                            =",
        "=                                                                                                                            =",
        "=                                                                                                                            =",
        "=                                                                                                                            =",
        "=                                                                                                                            =",
        "=                                                                                                                            =",
        "=                                                                                                                            =",
        "=                                                                                                                            =",
        "=                                                                                                                            =",
        "=                                                                                                                            =",
        "=                                                                                                                            =",
        "=                                                                                                                            =",
        "=                                                                                                                            =",
        "=                                                                                                                            =",
        "=                                                                                                                            =",
        "=                                                                                                                            =",
        "=                                                                                                                            =",
        "=                                               ooooooooooooooo                                                              =",
        "=                                               ooooooooooooooo                                                              =",
        "=                                               ooooooooooooooo                                                              =",
        "=  §                                            ===============                                                              =",
        "========                      ===                                                                                            =",
        "=                                                                                                                            =",
        "=                                            ===                                              *                              =",
        "=                 o                                                                     ===============                      =",
        "=                ===         ooo           ==                                                                                =",
        "=                         ======                                                                                             =",
        "=                                                                            g                                               =",
        "=                 ^                                                        =====                                             =",
        "=      ==     ==========                                                                                                     =",
        "=                                                                                                                            =",
        "=                        ===                                             =====                                               =",
        "=                                      oo                     #########################           ==========                 =",
        "=                                     ====                                                                                   =",
        "=                                                      oo                                                                    =",
        "=                                      oooo           =====             ^                                                    =",
        "=                                     =======                 ########=====##########==========                              =",
        "=                                                                                                                            =",
        "=                         ooo g                                                                                              =",
        "=                       =======                                                                                              =",
        "=                                                                                                                            =",
        "=P                            s             h                                                                                =",
        "============####=====================================####=========####========================================================",
        "                                                                                                                             =",
        "                                                                                                                             =",
        "                                                                                                                             =",
        "                                                                                                                             =",
        "                                                                                                                             =",
        "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    ],
        mapTokenConfig(element)
    );

    const player = addPlayer();

    sceneSetup({ player, element, nextLevel });

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
