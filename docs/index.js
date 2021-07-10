const GAME_SCALE = 3;
const CUTOFF_DISTANCE = 500;

const BULLET_SPEED = 300;
const PLAYER_MOVE_SPEED = 125;
const PLAYER_BOOST_SPEED = 200;
const PLAYER_JUMP_FORCE = 250;
const MAX_VELOCITY = 200;
const TILE_UNIT = 10;
const GRAVITY = 980;
const GOBLIN_JUMP_FORCE = 200;
const AIR_BLAST_FORCE = 50;
const LAVA_BUBBLE_JUMP_FORCE = 300;


kaboom({
    global: true,
    fullscreen: true,
    scale: GAME_SCALE,
    debug: true,
    clearColor: [0, 0, 0, 1],
});

const PLAYER_STATE = {
    health: 3,
    maxHealth: 3,
    maxBoosts: 1,
    numBoosts: 1,
    tempBoosts: 0,
    score: 0
};


const FIRE = "fire";
const WATER = "water";
const EARTH = "earth";
const AIR = "air";

const ELEMENTS = [FIRE, WATER, EARTH, AIR];

// COLORS
const LAVA_BUBBLE_COLOR = color(0.85, 0.25, 0.0);
const ICICLE_COLOR = color(0, 0.25, 0.85);


function generateBragText({ tookDamage, defeatedEnemy, collectedItem, retried }) {
    const bragIntros = [
        `As I stepped over the threshold into the chamber, I was filled with\ncomplete confidence in my exemplary skills and finesse.\n`,
        `This room was filled with horrific dangers the likes of which I\nhad never seen. Well, I had seen the likes of them, but ordinary people like you\ndefinitely haven't.\n`,
    ];

    const tookDamageBrags = [
        `I was invincible! None of the nightmarish dangers even came close to me.\n`,
        `I skillfully avoided every danger with, if I may say so, poise and elegance\n`,
    ];

    const defeatedNoEnemiesBrags = [
        `Every foul, slobbering monster fell before my might.\n`,
        `Not one soulless demon was left standing by the time I approached the exit.\n`
    ];

    const collectedNoItemBrags = [
        `I found treasures in that room you couldn't even imagine! Don't ask to see\nthem, though. They're... *ahem*, they're too dangerous for mortal eyes to behold.\n`,
        `As if my pockets weren't already heavy enough with gold and priceless artifacts,\nthis chamber was an absolute treasure trove!\n`,
    ];

    const concludingBrags = [
        `One step closer to the treasure I so clearly deserve!`,
        `If the rest of the temple is like this, I'll be home by lunch!`
    ];

    let bragText = choose(bragIntros);

    if (tookDamage || retried) {
        bragText += choose(tookDamageBrags);
    }

    if (!defeatedEnemy) {
        bragText += choose(defeatedNoEnemiesBrags);
    }

    if (!collectedItem) {
        bragText += choose(collectedNoItemBrags);
    }

    bragText += choose(concludingBrags);

    return bragText;
}

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

const getHazardTerrainForElement = (element) => {
    switch (element) {
        case FIRE:
            return [rect(TILE_UNIT, TILE_UNIT), color(1.0, 0.75, 0), solid(), "terrain", "lava", "kill"]; // Lava
        case WATER:
            return [rect(TILE_UNIT, TILE_UNIT), color(0, 1, 1), solid(), "terrain", "ice", "slippery"]; // Ice
        case EARTH:
            return [rect(TILE_UNIT, TILE_UNIT), color(0.25, 0.1, 0.1), solid(), "terrain", "crumblingBlock"]; // Crumbling block
        case AIR:
            return [rect(TILE_UNIT, TILE_UNIT), color(0, 0, 0, 0), "pit"]; // Empty pit
        default:
            return [rect(TILE_UNIT, TILE_UNIT), color(0, 0, 0, 0), "pit"]; // Empty pit
    }
}

const getHazardForElement = (element) => {
    switch (element) {
        case FIRE:
            return [rect(TILE_UNIT, TILE_UNIT), LAVA_BUBBLE_COLOR, "lavaBubble", "kill", { canJump: true, strength: 1 }];
        case WATER:
            return [rect(TILE_UNIT, TILE_UNIT), ICICLE_COLOR, solid(), "icicle", "ice", { canFall: true, strength: 1 }];
        case AIR:
            return [rect(TILE_UNIT, TILE_UNIT), color(0.75, 0.75, 0.75), "airBlast"];
    }
}


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
const coinComponents = [rect(5, 5), color(1.0, 1.0, 0), "coin"];
const extraBoostComponents = [rect(5, 5), color(0, 1.0, 1.0), "extraBoost"];
const majorHealthPotionComponents = [rect(TILE_UNIT, TILE_UNIT), color(1.0, 0, 0.5), body(), { strength: 3 }, "majorHealthPotion", "healthPotion", "potion"];
const minorHealthPotionComponents = [rect(5, 5), color(1.0, 0, 0.5), body(), { strength: 1 }, "minorHealthPotion", "healthPotion", "potion"];

const destroyBullet = (bullet) => {
    destroy(bullet);
    const bulletHitIndicator = add([...explosionComponents, pos(bullet.pos.x, bullet.pos.y)]);
    bulletHitIndicator.action(() => {
        bulletHitIndicator.width++;
        bulletHitIndicator.height++;
    });
    wait(0.125, () => {
        destroy(bulletHitIndicator);
    });
}

const breakCrate = (crate) => {
    destroy(crate);

    // Very rarely create an extra boost in the crate
    if (Math.round(rand(0, 1000)) === 71) {
        add([...extraBoostComponents, pos(crate.pos)]);
    } else if (Math.round(rand(0, 1000)) % 100 === 0) {
        // Less rarely add a major health potion
        add([...majorHealthPotionComponents, pos(crate.pos)]);
    } else if (Math.round(rand(0, 1000)) % 50 === 0) {
        // Even less rarely add a minor health potion
        add([...minorHealthPotionComponents, pos(crate.pos)]);
    } else if (Math.round(rand(0, 1000)) % 10 === 0) {
        // Fairly often add a coin
        add([...coinComponents, pos(crate.pos)]);
    }
}

const handleAirBlast = (obj) => {
    if (obj.jump) {
        obj.jump({ jumpForce: AIR_BLAST_FORCE });
    }
}

const mapTokenConfig = (element) => ({
    width: TILE_UNIT,
    height: TILE_UNIT,
    pos: vec2(0, 0),
    // End of level goal
    "*": [rect(TILE_UNIT / 2, TILE_UNIT / 2), origin("center"), "goal"],
    // Terrain & hazards
    // TODO: Change colors based on element
    "x": [rect(TILE_UNIT, TILE_UNIT), color(0, 0, 0, 0), "outOfBounds", "kill"], // Kill the player if they go out of bounds (like in a pit)
    "=": [rect(TILE_UNIT, TILE_UNIT), color(0.45, 0.1, 0.1), solid(), "terrain", "nonSlipperyTerrain"], // Ground
    "%": [rect(TILE_UNIT, TILE_UNIT), color(0.25, 0.25, 0.25), solid(), "crate"],// Destructible crates
    "#": getHazardTerrainForElement(element), // Elemental Hazard Terrain
    "!": getHazardForElement(element),
    // Collectibles & powerups
    "o": coinComponents, // Coin
    "P": ["playerStart"], // Player start
    "^": extraBoostComponents, // Extra boost powerup
    "§": respawningExtraBoostComponents, // Respawning Extra Boost powerup,
    "h": minorHealthPotionComponents, // Minor Health Potion
    "H": majorHealthPotionComponents, // Major Health Potion
    // Enemies
    "S": [rect(5, 5), color(0.25, 0.75, 0.95), body({ maxVel: MAX_VELOCITY }), { strength: 1, health: 1, scoreValue: 1 }, "slime", "enemy"],// Slime
    "G": [rect(TILE_UNIT, TILE_UNIT), color(0, 1.0, 0), body({ maxVel: MAX_VELOCITY }), { strength: 1, health: 2, canShoot: true, scoreValue: 5 }, "goblin", "enemy"], // Goblin,
});

function addPlayer() {
    return add([
        rect(TILE_UNIT, TILE_UNIT),
        color(1.0, 0, 0),
        pos(-1000, -1000), // Start offscreen. Let every("playerStart") put the player in the right place
        body({ maxVel: MAX_VELOCITY }),
        "player",
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
            moveSpeed: PLAYER_MOVE_SPEED,
            isFreezing: false,
            score: 0
        }
    ]);
}

function sceneSetup({ player, element, currentLevel, nextLevel, hasRetried }) {
    PLAYER_STATE.health = PLAYER_STATE.maxHealth;
    const sceneState = {
        defeatedEnemy: false,
        collectedItem: false,
        retried: hasRetried,
        tookDamage: false,
    };
    debug.showLog = true;
    gravity(GRAVITY);

    player.action(() => {
        camPos(player.pos.x, player.pos.y - 50);

        if (player.isFreezing) {
            PLAYER_STATE.health -= 0.0125;
            healthText.text = getPlayerHealth();
        }
    });

    const score = add([
        text(`Score: 0`, 8),
        color(1.0, 1.0, 0),
        pos(player.pos.x, player.pos.y - 100),
        { value: 0 }
    ]);

    score.action(() => {
        score.pos.x = player.pos.x - 200;
        score.pos.y = player.pos.y - 175;
    });

    const boostText = add([
        text(getBoostIndicators(player), 8),
        color(0, 1.0, 1.0),
        pos(score.pos.x + score.width + 25, score.pos.y),
        { value: PLAYER_STATE.maxBoosts + PLAYER_STATE.tempBoosts }
    ]);

    boostText.action(() => {
        // Set it to position of score text, shifted right by width of score text
        // Setting directly using score.pos.x leads to staggered text movement
        boostText.pos.x = player.pos.x - (200 - score.width) + 25;
        boostText.pos.y = player.pos.y - 175;
    });

    const healthText = add([
        text(getPlayerHealth(), 8),
        color(1.0, 0, 0),
        pos(boostText.pos.x + boostText.width + 25, boostText.pos.y),
        { value: PLAYER_STATE.health }
    ]);

    healthText.action(() => {
        healthText.pos.x = player.pos.x - (200 - score.width - boostText.width - 25) + 25;;
        healthText.pos.y = player.pos.y - 175;
    });

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
            sceneState.hasDefeatedEnemy = true;
        });

        enemy.collides("airBlast", () => {
            handleAirBlast(enemy);
        });

        if (enemy.health <= 0) {
            destroy(enemy);
            sceneState.hasDefeatedEnemy = true;
            const explosion = add([...explosionComponents, color(1.0, 0.5, 0), pos(enemy.pos.x, enemy.pos.y)]);
            explosion.action(() => {
                explosion.width++;
                explosion.height++;
            });
            PLAYER_STATE.score += enemy.scoreValue;
            score.text = `Score: ${PLAYER_STATE.score}`;
            wait(0.125, () => {
                destroy(explosion);
            });
        }
    });

    every("crate", (crate) => {
        // crate.collides("PLAYER_BULLET", () => {
        //     breakCrate(crate);
        // });

        crate.collides("ENEMY_BULLET", () => {
            breakCrate(crate);
        });
    });

    // every("goblin", (goblin) => {
    //     loop(1.25, () => {

    //     });
    // });

    action("goblin", (goblin) => {
        // Don't move if it's too far from the player
        if (goblin.pos.dist(player.pos) <= CUTOFF_DISTANCE) {
            goblin.move(-50, 0);

            // Don't shoot if it's too far from the player
            if (Math.round(rand(0, 100)) % 23 === 0 && goblin.canShoot) {
                let bulletSpeedX = BULLET_SPEED;
                let bulletSpeedY = 0;

                // Shoot right if distance is positive, left if distance is negative
                const direction = player.pos.x - goblin.pos.x >= 0 ? 1 : -1;

                bulletSpeedX *= direction;

                const bullet = add([
                    rect(5, 5),
                    color(0.25, 1.0, 0.1),
                    pos(goblin.pos.x, goblin.pos.y),
                    "ENEMY_BULLET",
                    { strength: goblin.strength }
                ]);

                bullet.action(() => {
                    bullet.move(bulletSpeedX, bulletSpeedY);
                });

                bullet.collides("player", () => destroyBullet(bullet));
                bullet.collides("enemy", () => destroyBullet(bullet));
                bullet.collides("terrain", () => destroyBullet(bullet));
                bullet.collides("crate", (crate) => {
                    breakCrate(crate);
                    destroyBullet(bullet);
                });

                goblin.canShoot = false;

                wait(1, () => {
                    destroy(bullet);
                    goblin.canShoot = true;
                });
            }
        }
    });

    action("slime", (slime) => {
        if (slime.pos.dist(player.pos) <= CUTOFF_DISTANCE) {
            slime.move(-20, 0);
        }
    });

    every("lavaBubble", (lavaBubble) => {
        lavaBubble.action(() => {
            if (lavaBubble.canJump) {
                // Create a bubble in the middle horizontally and slightly above the block
                const bubble = add([rect(TILE_UNIT / 2, TILE_UNIT / 2), LAVA_BUBBLE_COLOR, pos(lavaBubble.pos.x + (TILE_UNIT / 4), lavaBubble.pos.y - (TILE_UNIT / 2)), body({ jumpForce: LAVA_BUBBLE_JUMP_FORCE })]);

                bubble.collides("lavaBubble", () => {
                    destroy(bubble);
                });
                bubble.collides("player", () => {
                    PLAYER_STATE.health -= lavaBubble.strength;
                    healthText = getPlayerHealth();
                });
                bubble.collides("enemy", () => {
                    enemy.health -= lavaBubble.strength;
                });

                bubble.jump();

                lavaBubble.canJump = false;

                wait(1.5, () => {
                    lavaBubble.canJump = true;
                });
            }
        });
    });

    every("icicle", (icicle) => {
        icicle.action(() => {
            if (icicle.canFall && (icicle.pos.y < player.pos.y) && (Math.abs(icicle.pos.x - player.pos.x) < 5)) {
                const icicleDrop = add([rect(TILE_UNIT / 2, TILE_UNIT), ICICLE_COLOR, pos(icicle.pos.x + (TILE_UNIT / 4), icicle.pos.y + 10), body({ maxVel: 200 })]);

                icicleDrop.collides("player", () => {
                    PLAYER_STATE.health -= icicle.strength;
                    healthText.text = getPlayerHealth();
                    destroy(icicleDrop);
                });
                icicleDrop.collides("enemy", () => {
                    enemy.health -= icicle.strength;
                    destroy(icicleDrop);
                });
                icicleDrop.collides("terrain", () => {
                    destroy(icicleDrop);
                });

                icicle.canFall = false;

                wait(1.5, () => {
                    icicle.canFall = true;
                });
            }
        });
    });

    player.collides("goal", () => {
        go("interlude", { currentLevel, nextLevel, previousElement: element, ...sceneState });
    });

    player.collides("kill", () => {
        // Insta-kill the player (for things like lava and spikes)
        go(currentLevel, { currentLevel, previousElement: element, hasRetried: true });
    });

    player.collides("crumblingBlock", (crumblingBlock) => {
        // Shrink the block vertically to show that it's breaking, then destroy it
        action(() => {
            if (crumblingBlock.height > 0) {
                crumblingBlock.height--;
            }
        });
        wait(0.25, () => {
            destroy(crumblingBlock);
        })
    });

    player.collides("airBlast", () => {
        handleAirBlast(player);
    });

    player.collides("ice", () => {
        if (player.grounded()) {
            player.moveSpeed = PLAYER_MOVE_SPEED * 2;
            player.isFreezing = true;
        }
    });

    player.collides("nonSlipperyTerrain", () => {
        if (player.grounded()) {
            player.moveSpeed = PLAYER_MOVE_SPEED;
            player.isFreezing = false;
        }
    });

    player.collides("enemy", (enemy) => {
        PLAYER_STATE.health -= enemy.strength;
        healthText.text = getPlayerHealth();
        sceneState.tookDamage = true;
    });

    player.collides("ENEMY_BULLET", (bullet) => {
        PLAYER_STATE.health -= bullet.strength;
        healthText.text = getPlayerHealth();
        sceneState.tookDamage = true;
    });

    player.collides("boss", (boss) => {
        PLAYER_STATE.health -= boss.strength;
        healthText.text = getPlayerHealth();
    });

    player.collides("coin", (coin) => {
        destroy(coin);
        PLAYER_STATE.score++;
        score.text = `Score: ${PLAYER_STATE.score}`;
        sceneState.collectedItem = true;
    });

    player.collides("healthPotion", (potion) => {
        destroy(potion);
        if (PLAYER_STATE.health + potion.strength < PLAYER_STATE.maxHealth) {
            PLAYER_STATE.health += potion.strength;
        } else {
            PLAYER_STATE.health = PLAYER_STATE.maxHealth;
        }
        healthText.text = getPlayerHealth(player);
        sceneState.collectedItem = true;
    });

    player.collides("extraBoost", (extraBoost) => {
        destroy(extraBoost);
        PLAYER_STATE.tempBoosts++;
        boostText.text = getBoostIndicators(player);
        sceneState.collectedItem = true;
    });

    player.collides("respawningExtraBoost", (respawningExtraBoost) => {
        const itemPos = respawningExtraBoost.pos;

        destroy(respawningExtraBoost);

        PLAYER_STATE.tempBoosts++;
        boostText.text = getBoostIndicators(player);
        sceneState.collectedItem = true;

        wait(5, () => {
            add([...respawningExtraBoostComponents, pos(itemPos.x, itemPos.y)]);
        });
    });

    player.on("grounded", () => {
        // If they boosted, give them their boost back when they hit the ground
        if (PLAYER_STATE.numBoosts < PLAYER_STATE.maxBoosts) {
            PLAYER_STATE.numBoosts++;
        }
        // Update the UI indicator of the number of boosts available
        boostText.text = getBoostIndicators(player);
    })

    // there's no spatial hashing yet, if too many blocks causing lag, consider hard disabling collision resolution from blocks far away by turning off 'solid'
    // (from the Kaboom docs)
    // Re-enable and troubleshoot if performance tanks
    // action("terrain", (terrain) => {
    //     terrain.solid = player.pos.dist(terrain.pos) <= CUTOFF_DISTANCE;
    // });

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

            bullet.collides("enemy", () => destroyBullet(bullet));
            bullet.collides("terrain", () => destroyBullet(bullet));
            bullet.collides("crate", (crate) => {
                breakCrate(crate);
                destroyBullet(bullet);
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
            });
        }
    });

    keyDown(RIGHT, () => {
        // If they're boosting, ignore arrow keys
        if (!player.boostTarget) {
            player.move(player.moveSpeed, 0);
        }
    });

    keyDown(LEFT, () => {
        // If they're boosting, ignore arrow keys
        if (!player.boostTarget) {
            player.move(-player.moveSpeed, 0);
        }
    });

    keyPress(BOOST, () => {
        // if (player.canBoost) {
        if ((PLAYER_STATE.numBoosts + PLAYER_STATE.tempBoosts) > 0) {
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
            if (PLAYER_STATE.numBoosts > 0) {
                PLAYER_STATE.numBoosts--;
            } else if (PLAYER_STATE.tempBoosts > 0) {
                PLAYER_STATE.tempBoosts--;
            }

            // Update the UI indicator of the number of boosts available
            boostText.text = getBoostIndicators(player);

            // Clear out boost target after .25s to avoid player getting pulled toward target forever
            wait(0.25, () => {
                gravity(GRAVITY);
                player.boostTarget = null;
            });
        }
    });

    player.action(() => {

        if (PLAYER_STATE.health <= 0) {
            go(currentLevel, { currentLevel, previousElement: element, hasRetried: true });
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

function getPlayerHealth() {
    // Create a * character for each boost available
    let health = '';
    for (let i = 0; i < (PLAYER_STATE.health); i++) {
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
    for (let i = 0; i < (PLAYER_STATE.numBoosts + PLAYER_STATE.tempBoosts); i++) {
        boostIndicators += '*';
    }

    return `Boosts: ${boostIndicators || ' '}`;
}

scene("gameOver", ({ returnScene, lastElement }) => {
    add([text("Game Over. Press ENTER to try again", 12), pos(width() / 2, height() / 2)]);

    keyPress(["enter", "space"], () => {
        const newElement = getElement(lastElement);
        go(returnScene, { element: newElement });
    });
});

scene("one", ({ previousElement }) => {
    const nextLevel = "two";
    const element = getElement(previousElement);
    const map = addLevel([
        "==============================",
        "=                            =",
        "=                            =",
        "=                          * =",
        "=            o           =====",
        "=          o ==              =",
        "=        o                   =",
        "=      o                     =",
        "=ooo o                       =",
        "====                     oooo=",
        "=                 o o    =====",
        "=              o  ====       =",
        "=            o               =",
        "=P          o                =",
        "=================######=======",
        "                              ",
        "                              ",
        "                              ",
        "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    ],
        mapTokenConfig(element)
    );

    const player = addPlayer();

    sceneSetup({ player, element, currentLevel: "one", nextLevel });

    // Use the "playerStart" object from the map to set start position
    every("playerStart", (playerStart) => {
        player.pos.x = playerStart.pos.x;
        player.pos.y = playerStart.pos.y;
    });
});

scene("two", ({ lastElement }) => {
    const nextLevel = "three";
    const element = getElement(lastElement);
    const map = addLevel([
        "====================================================",
        "=                                   %              =",
        "=                                   %              =",
        "=                                   %              =",
        "=   !!                              %     ##       =",
        "=                                   %              =",
        "=          oo           o           %     oo     * =",
        "=          ==          =!=          ================",
        "=                                                  =",
        "=                                                  =",
        "=   ==###                     ooo                 =",
        "=                             o   o                =",
        "= P     ooo             S                          =",
        "===============================###==================",
        "                                                    ",
        "                                                    ",
        "                                                    ",
        "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    ],
        mapTokenConfig(element)
    );

    const player = addPlayer();

    sceneSetup({ player, element, currentLevel: "two", nextLevel });

    // Use the "playerStart" object from the map to set start position
    every("playerStart", (playerStart) => {
        player.pos.x = playerStart.pos.x;
        player.pos.y = playerStart.pos.y;
    });
});

scene("interlude", ({ currentLevel, previousElement, nextLevel, tookDamage, defeatedEnemy, collectedItem, retried }) => {
    add([
        text(`
        Level ${currentLevel} complete!

        Goom's log:

        `, 10),
        pos(10, 0)
    ]);

    const bragText = generateBragText({ tookDamage, defeatedEnemy, collectedItem, retried });

    add([
        text(`"${bragText}"`, 6),
        pos(10, 100)
    ]);

    add([
        text("Press ENTER to continue", 8),
        pos(10, 150)
    ]);

    keyPress("enter", () => {
        go(nextLevel, { previousElement });
    });


});

start("one", {});
