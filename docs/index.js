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

// See https://stackoverflow.com/questions/27078285/simple-throttle-in-js
function throttle(cb, timeout) {
    let waiting = false;
    return () => {
        if (!waiting) {
            waiting = true;
            cb();
            setTimeout(() => {
                waiting = false;
            }, timeout);
        }
    }
}


kaboom({
    global: true,
    fullscreen: true,
    scale: GAME_SCALE,
    debug: true,
    clearColor: [0, 0, 0, 1],
});

const FIRE = "fire";
const WATER = "water";
const EARTH = "earth";
const AIR = "air";
const NONE = "none"; // Just for player gun

const ELEMENTS = [FIRE, WATER, EARTH, AIR];

const spellNames = {
    [FIRE]: "Fireball",
    [WATER]: "Ice spear",
    [EARTH]: "Boulder",
    [AIR]: "Tornado",
    [NONE]: "Crossbow"
}

const PLAYER_STATE = {
    color: color(1.0, 0, 0),
    health: 3,
    maxHealth: 3,
    maxBoosts: 1,
    numBoosts: 1,
    tempBoosts: 0,
    moveSpeed: PLAYER_MOVE_SPEED,
    score: 0,
    direction: 1, // Aiming direction. 1 for right, -1 for left
    hasRemoteControl: false,
    ammoElement: NONE,
    availableAmmos: [NONE],
};

// COLORS
const TERRAIN_COLOR_FIRE = color();
const TERRAIN_COLOR_WATER = color();
const TERRAIN_COLOR_AIR = color();
const TERRAIN_COLOR_EARTH = color();
const LAVA_BUBBLE_COLOR = color(0.85, 0.25, 0.0);
const ICICLE_COLOR = color(0, 0.25, 0.85);
const EARTH_SPIKE_COLOR = color(0.25, 0.25, 0);
const METAL_SPIKE_COLOR = color(0.25, 0.25, 0.25);


function generateBragText({ tookDamage, defeatedEnemy, collectedItem, retried }) {
    const bragIntros = [
        `As I stepped over the threshold into the chamber, I was filled with\ncomplete confidence in my exemplary skills and finesse.\n`,
        `This room was filled with horrific dangers the likes of which I\nhad never seen.\n`,
        `A dark, cavernous chamber loomed before me.\n`,
        `Peering into the darkness, I wondered what treacherous\ntraps lay ahead this time.\n`
    ];

    const tookDamageBrags = [
        `I was invincible! None of the nightmarish dangers even came close to me.\n`,
        `I skillfully avoided every danger with, if I may say so, poise and elegance.\n`,
        `The dangers swarmed around me, but nothing could so much as lay a finger on me!\n`
    ];

    const defeatedNoEnemiesBrags = [
        `Every foul, slobbering monster fell before my might.\n`,
        `Not one soulless demon was left standing by the time I approached the exit.\n`,
        `My unparalleled skill and power made short work of\nthe horde of monsters lurking here.\n`
    ];

    const collectedNoItemBrags = [
        `I found treasures in that room you couldn't even imagine!\n`,
        `This chamber was an absolute treasure trove! I could hardly carry it all!\n`,
        `I found enough treasure in that room to buy the whole town twice over!\n`
    ];

    const concludingBrags = [
        `Having risked life and limb, I am one step closer...\nthat treasure is mine!`,
        `My life was hanging by a thread, but nothing could sway me from my quest!`,
        `Another exhilirating challenge, but of course it was no match for me!`
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
    // Return value from query param if present
    if (elementOverride) {
        return elementOverride;
    }
    // Filter out the last element so you never get a back-to-back repeat
    const filteredElements = ELEMENTS.filter(e => e !== lastElement);

    return choose(filteredElements);
}

const getTerrainColorForElement = (element) => {
    switch (element) {
        case FIRE:
            return color(0.45, 0.1, 0.1);
        case WATER:
            return color(0.1, 0.1, 0.45);
        case EARTH:
            return color(0.35, 0.15, 0.15);
        case AIR:
            return color(0.45, 0.45, 0.45);
    }
}

const getHazardTerrainForElement = (element) => {
    switch (element) {
        case FIRE:
            return [rect(TILE_UNIT, TILE_UNIT), color(1.0, 0.75, 0), solid(), "lava", "kill"]; // Lava
        case WATER:
            return [rect(TILE_UNIT, TILE_UNIT), color(0, 1, 1), solid(), "terrain", "ice", "slippery"]; // Ice
        case EARTH:
            return [rect(TILE_UNIT, TILE_UNIT), color(0.15, 0.1, 0.1), solid(), "terrain", "standardTerrain", "crumblingBlock"]; // Crumbling block
        case AIR:
            return [rect(TILE_UNIT, TILE_UNIT), color(0.75, 0.75, 0.75), "airBlast"]; // Air blast
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
        case EARTH:
            return [rect(TILE_UNIT, TILE_UNIT), EARTH_SPIKE_COLOR, solid(), "earthSpike", { strength: 0.25 }];
        case AIR:
            return [rect(TILE_UNIT, TILE_UNIT), color(0, 0, 0, 0), "pit"]; // Empty pit

    }
}


// Keys
const UP = "w";
const RIGHT = "d";
const DOWN = "s";
const LEFT = "a";
const SHOOT = "space";
const BOOST = "shift";
const AIM = "/";
const AMMO_CYCLE_BACK = ["up", "left"];
const AMMO_CYCLE_FORWARD = ["down", "right"];

// Reusable components for creating things dynamically
const goalComponents = [rect(TILE_UNIT / 2, TILE_UNIT / 2), origin("center"), "goal"];
const respawningExtraBoostComponents = [rect(5, 5), color(1.0, 0, 1.0), "respawningExtraBoost"];
const explosionComponents = [rect(TILE_UNIT, TILE_UNIT), color(1, 1, 1), origin("center"), "explosion"];
const coinComponents = [rect(5, 5), color(1.0, 1.0, 0), "coin"];
const extraBoostComponents = [rect(5, 5), color(0, 1.0, 1.0), "extraBoost"];
const majorHealthPotionComponents = [rect(TILE_UNIT, TILE_UNIT), color(1.0, 0, 0.5), body(), { strength: 3 }, "majorHealthPotion", "healthPotion", "potion"];
const minorHealthPotionComponents = [rect(5, 5), color(1.0, 0, 0.5), body(), { strength: 1 }, "minorHealthPotion", "healthPotion", "potion"];
const maxHealthUpComponents = [rect(TILE_UNIT * 2, TILE_UNIT), color(1.0, 0, 0), "maxHealthUp"];
const maxBoostUpComponents = [rect(TILE_UNIT * 2, TILE_UNIT), color(0, 1.0, 1.0), "maxBoostUp"];

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
    if (Math.round(rand(0, 1000)) % 100 === 0) {
        add([...extraBoostComponents, pos(crate.pos)]);
    } else if (Math.round(rand(0, 1000)) % 50 === 0) {
        // Less rarely add a major health potion
        add([...majorHealthPotionComponents, pos(crate.pos)]);
    } else if (Math.round(rand(0, 1000)) % 10 === 0) {
        // Even less rarely add a minor health potion
        add([...minorHealthPotionComponents, pos(crate.pos)]);
    } else if (Math.round(rand(0, 1000)) % 2 === 0) {
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
    "*": goalComponents, // Goal
    // Terrain & hazards
    // TODO: Change colors based on element
    "x": [rect(TILE_UNIT, TILE_UNIT), color(0, 0, 0, 0), "outOfBounds", "kill"], // Kill the player if they go out of bounds (like in a pit)
    "=": [rect(TILE_UNIT, TILE_UNIT), getTerrainColorForElement(element), solid(), "terrain", "standardTerrain"], // Ground
    "%": [rect(TILE_UNIT, TILE_UNIT), color(0.25, 0.25, 0.25), solid(), "crate"],// Destructible crates
    "#": getHazardTerrainForElement(element), // Elemental Hazard Terrain
    "!": getHazardForElement(element),
    "@": [rect(TILE_UNIT, TILE_UNIT), color(0.1, 0.1, 0.1), solid(), "exitBlocker"], // Exit blockers
    "+": [rect(TILE_UNIT, TILE_UNIT), METAL_SPIKE_COLOR, solid(), "kill", "spike"], // Metal spikes (non-elemental)
    // Collectibles & powerups
    "o": coinComponents, // Coin
    "P": ["playerStart"], // Player start
    "^": extraBoostComponents, // Extra boost powerup
    "§": respawningExtraBoostComponents, // Respawning Extra Boost powerup,
    "h": minorHealthPotionComponents, // Minor Health Potion
    "H": majorHealthPotionComponents, // Major Health Potion
    // Permanent items
    "R": [rect(TILE_UNIT * 2, TILE_UNIT), color(0.15, 1.0, 0.15), "remoteControl"], // TODO: Is this a useful item?
    "B": ["maxBoostUpSpawner"], // Permanent extra boost spawner (conditionally added if player doesn't have it already)
    "U": maxHealthUpComponents, // Permanent extra heart
    // Enemies
    "S": [rect(TILE_UNIT, TILE_UNIT / 2), color(0.25, 0.75, 0.95), body(), { strength: 1, health: 1, scoreValue: 1 }, "slime", "enemy"],// Slime
    "G": [rect(TILE_UNIT, TILE_UNIT), color(0, 1.0, 0), body({ jumpForce: GOBLIN_JUMP_FORCE }), { strength: 1, health: 2, canShoot: true, scoreValue: 5 }, "goblin", "enemy"], // Goblin,
    // Bosses
    "A": [rect(TILE_UNIT * 2, TILE_UNIT * 2), color(0.45, 0.75, 0.45), { strength: 2, health: 10, scoreValue: 150 }, "arachnos", "enemy"], // Arachnos (Boss 1)
});

function addPlayer() {

    return add([
        rect(TILE_UNIT, TILE_UNIT),
        PLAYER_STATE.color,
        pos(-1000, -1000), // Start offscreen. Let every("playerStart") put the player in the right place
        body({ maxVel: MAX_VELOCITY, jumpForce: PLAYER_JUMP_FORCE }),
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

function sceneSetup({ player, element, currentLevel, nextLevel, map, hasRetried, targetMaxBoosts }) {
    if (elementOverride) {
        debug.log(elementOverride);
    }
    PLAYER_STATE.health = PLAYER_STATE.maxHealth;

    // Make obj default layer
    layers([
        "ui",
        "obj"
    ], "obj");

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

        if (PLAYER_STATE.isFreezing) {
            PLAYER_STATE.health -= 0.0125;
            healthText.text = getPlayerHealth();
        }
    });

    const score = add([
        text(`Score: ${PLAYER_STATE.score}`, 8),
        color(1.0, 1.0, 0),
        pos(0, 0),
        { value: 0 },
        layer("ui")
    ]);


    const boostText = add([
        text(getBoostIndicators(player), 8),
        color(0, 1.0, 1.0),
        pos(150, 0),
        { value: PLAYER_STATE.maxBoosts + PLAYER_STATE.tempBoosts },
        layer("ui")
    ]);

    const healthText = add([
        text(getPlayerHealth(), 8),
        color(1.0, 0, 0),
        pos(300, 0),
        { value: PLAYER_STATE.health },
        layer("ui")
    ]);

    const ammoText = add([
        text(`Weapon: ${spellNames[PLAYER_STATE.ammoElement]}`, 8),
        color(1.0, 1.0, 0),
        pos(0, 20),
        layer("ui")
    ]);

    // Leave the UI alone as the camer moves around
    camIgnore(["ui"]);


    // Use the "playerStart" object from the map to set start position
    every("playerStart", (playerStart) => {
        player.pos.x = playerStart.pos.x;
        player.pos.y = playerStart.pos.y;
    });

    every("enemy", (enemy) => {
        enemy.collides("PLAYER_BULLET", () => {
            enemy.health -= player.strength;
        });

        enemy.collides("kill", () => {
            // TODO: Let fire enemies walk on lava
            destroy(enemy);
            sceneState.defeatedEnemy = true;
        });

        enemy.collides("airBlast", () => {
            handleAirBlast(enemy);
        });
    });

    action("enemy", (enemy) => {
        if (enemy.health <= 0) {
            destroy(enemy);
            sceneState.defeatedEnemy = true;
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

    every("maxBoostUpSpawner", (maxBoostUpSpawner) => {
        if (PLAYER_STATE.maxBoosts < targetMaxBoosts) {
            add([...maxBoostUpComponents, pos(maxBoostUpSpawner.pos)]);
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

    every("goblin", (goblin) => {
        goblin.action(() => {
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
    });

    every("slime", (slime) => {
        try {
            slime.action(() => {
                if (slime.pos.dist(player.pos) <= CUTOFF_DISTANCE) {
                    slime.move(-20, 0);
                }
            });
        } catch (e) {
            debug.log(e.message);
        }
    });

    every("lavaBubble", (lavaBubble) => {
        lavaBubble.action(() => {
            if (lavaBubble.canJump) {
                // Create a bubble in the middle horizontally and slightly above the block
                const bubble = add([rect(TILE_UNIT / 2, TILE_UNIT / 2), LAVA_BUBBLE_COLOR, pos(lavaBubble.pos.x + (TILE_UNIT / 4), lavaBubble.pos.y - (TILE_UNIT / 2))]);

                bubble.collides("lavaBubble", () => {
                    destroy(bubble);
                });
                bubble.collides("player", () => {
                    PLAYER_STATE.health -= lavaBubble.strength;
                    healthText.text = getPlayerHealth();
                });
                bubble.collides("enemy", () => {
                    enemy.health -= lavaBubble.strength;
                });
                bubble.collides("terrain", () => {
                    destroy(bubble);
                });

                // bubble.jump();
                bubble.action(() => {
                    let count = 0;
                    if (!bubble.overlaps("terrain")) {
                        count++;
                        bubble.move(0, Math.sin(count));
                    }
                });

                lavaBubble.canJump = false;

                wait(1.5, () => {
                    lavaBubble.canJump = true;
                });
            }
        });
    });

    every("icicle", (icicle) => {
        icicle.action(async () => {
            if (icicle.canFall && (icicle.pos.y < player.pos.y) && (Math.abs(icicle.pos.x - player.pos.x) < 5)) {
                await wait(0.25);
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

                wait(0.5, () => {
                    destroy(icicleDrop);
                });

                wait(1.5, () => {
                    icicle.canFall = true;
                });
            }
        });
    });

    every("spike", (spike) => {
        // Add spikes to make it look dangerous
        add([
            rect(TILE_UNIT / 8, TILE_UNIT),
            pos(spike.pos.x, spike.pos.y - (TILE_UNIT / 4)),
            METAL_SPIKE_COLOR,
        ]);
        add([
            rect(TILE_UNIT / 4, TILE_UNIT),
            pos(spike.pos.x + (TILE_UNIT / 2), spike.pos.y - (TILE_UNIT / 2)),
            METAL_SPIKE_COLOR,
        ]);
        add([
            rect(TILE_UNIT / 4, TILE_UNIT),
            pos(spike.pos.x + (TILE_UNIT / 2), spike.pos.y - (TILE_UNIT / 2)),
            METAL_SPIKE_COLOR,
        ]);
    });

    every("earthSpike", (spike) => {
        // Add spikes to make it look dangerous
        add([
            rect(TILE_UNIT / 8, TILE_UNIT),
            pos(spike.pos.x, spike.pos.y - (TILE_UNIT / 4)),
            EARTH_SPIKE_COLOR,
        ]);
        add([
            rect(TILE_UNIT / 4, TILE_UNIT),
            pos(spike.pos.x + (TILE_UNIT / 2), spike.pos.y - (TILE_UNIT / 2)),
            EARTH_SPIKE_COLOR
        ]);
        add([
            rect(TILE_UNIT / 4, TILE_UNIT),
            pos(spike.pos.x + (TILE_UNIT / 2), spike.pos.y - (TILE_UNIT / 2)),
            EARTH_SPIKE_COLOR
        ]);
    });

    every("arachnos", (arachnos) => {
        let target = vec2(player.pos.x + rand(-10, 10), player.pos.y + rand(-10, 10));

        arachnos.overlaps("terrain", () => {
            target = vec2(player.pos.x + rand(-10, 10), player.pos.y + rand(-10, 10));
        });

        arachnos.on("destroy", () => {
            const lastArachnosPos = arachnos.pos;
            const collectedRewards = [];
            const maxHealthUp = add([...maxHealthUpComponents, pos((width() / 2), 100)]);
            const maxBoostUp = add([...maxBoostUpComponents, pos((width() / 2) - 40, 100)]);
            const earthGun = add([rect(TILE_UNIT * 2, TILE_UNIT), EARTH_SPIKE_COLOR, pos((width() / 2) - 80, 100), "earthGun"]);


            for (let i = 0; i < 10; i++) {
                add([...coinComponents, pos((width() / 2) - (80 - (i * 10)), 100)]);
            }

            earthGun.collides("player", () => {
                PLAYER_STATE.availableAmmos.push(EARTH);
                destroy(earthGun);
            });

            maxHealthUp.collides("player", () => {
                collectedRewards.push("maxHealthUp");
                debug.log("Rewards? " + collectedRewards.length);

                if (!maxBoostUp.exists()) {
                    add([...goalComponents, pos((width() / 2) - 80, 80)]);
                }

                destroy(maxHealthUp);

            });

            maxBoostUp.collides("player", () => {
                collectedRewards.push("maxBoostUp");
                debug.log("Rewards? " + collectedRewards.length);
                if (!maxHealthUp.exists()) {
                    add([...goalComponents, pos(lastArachnosPos)]);
                }

                destroy(maxBoostUp);

            });


        });

        let actionCounter = 0;

        // arachnos.action(throttle(() => {
        arachnos.action(() => {
            actionCounter++;
            const distanceFromTarget = arachnos.pos.dist(target);
            const distanceFromPlayer = arachnos.pos.dist(player.pos);


            if (distanceFromPlayer > CUTOFF_DISTANCE) {
                return;
            }

            if (distanceFromTarget < arachnos.width) {
                target = vec2(player.pos.x + rand(-100, 100), player.pos.y + rand(-100, 100));
            }

            // TODO: Don't need this if terrain collisions aren't laggy
            // const distanceToRightBoundary = Math.abs(arachnos.pos.x - map.width());
            // const distanceToBottomBoundary = Math.abs(arachnos.pos.y - map.height());
            //  else if (
            //     distanceFromTarget < 5 ||
            //     distanceToRightBoundary < (arachnos.width * 2)
            //     || arachnos.pos.x < (arachnos.width * 2)
            //     || distanceToBottomBoundary < (arachnos.height * 2)
            //     || arachnos.pos.y < (arachnos.height * 2)
            // ) {
            //     // If we hit the target, or came close to the top or bottom or left or right world bounds
            //     target = vec2(player.pos.x + rand(-50, 50), player.pos.y + rand(-50, 50));
            // }

            const directionX = arachnos.pos.x < target.x ? 1 : -1;
            const directionY = arachnos.pos.y < target.y ? 1 : -1;
            const speed = distanceFromPlayer > 50 ? 100 : 10;
            arachnos.move(speed * directionX, speed * directionY);

            // }, 250));
        });
    });

    player.collides("goal", () => {
        go("interlude", { currentLevel, nextLevel, previousElement: element, ...sceneState });
    });

    player.collides("kill", () => {
        // Insta-kill the player (for things like lava and spikes)
        go(currentLevel, { currentLevel, previousElement: element, hasRetried: true });
    });

    player.collides("spike", (spike) => {
        PLAYER_STATE.health -= spike.strength;
        healthText.text = getPlayerHealth();
    });

    player.collides("earthSpike", (spike) => {
        PLAYER_STATE.health -= spike.strength;
        PLAYER_STATE.moveSpeed = PLAYER_MOVE_SPEED / 2;
        healthText.text = getPlayerHealth();
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
            PLAYER_STATE.moveSpeed = PLAYER_MOVE_SPEED * 2;
            PLAYER_STATE.isFreezing = true;
        }
    });

    player.collides("standardTerrain", () => {
        if (player.grounded()) {
            PLAYER_STATE.moveSpeed = PLAYER_MOVE_SPEED;
            PLAYER_STATE.isFreezing = false;
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

    player.collides("maxBoostUp", (maxBoostUp) => {
        PLAYER_STATE.maxBoosts++;
        PLAYER_STATE.numBoosts = PLAYER_STATE.maxBoosts;
        boostText.text = getBoostIndicators(player);
        sceneState.collectedItem = true;
        destroy(maxBoostUp);
    });

    player.collides("maxHealthUp", (maxHealthUp) => {
        PLAYER_STATE.maxHealth++;
        PLAYER_STATE.health = PLAYER_STATE.maxHealth;
        healthText.text = getPlayerHealth();
        sceneState.collectedItem = true;
        destroy(maxHealthUp);
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

    player.collides("remoteControl", (remoteControl) => {
        PLAYER_STATE.hasRemoteControl = true;
        PLAYER_STATE.color = color(0.15, 1.0, 0.15);
        destroy(remoteControl);
    });

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

            const direction = PLAYER_STATE.direction;

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
            } else if (keyIsDown(DOWN)) {
                bulletSpeedX = 0;
                bulletSpeedY = BULLET_SPEED;
            }

            bullet.action(() => {
                // The Remote Control power lets players redirect their bullets in the air!
                if (PLAYER_STATE.hasRemoteControl) {
                    bullet.move(bulletSpeedX * PLAYER_STATE.direction, bulletSpeedY);
                } else {
                    bullet.move(bulletSpeedX * direction, bulletSpeedY);
                }
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

    // If they're boosting or airborne or holding down the aim button, ignore arrow keys
    keyPress(UP, () => {
        if (player.grounded() && !player.boostTarget && !keyIsDown(AIM)) {
            player.jump();
        }
    });

    keyDown(RIGHT, () => {
        PLAYER_STATE.direction = 1;
        // If they're boosting or holding down the aim button, ignore arrow keys
        if (!player.boostTarget && !keyIsDown(AIM)) {
            player.move(PLAYER_STATE.moveSpeed, 0);
        }
    });

    keyDown(LEFT, () => {
        PLAYER_STATE.direction = -1;
        // If they're boosting or holding down the aim button, ignore arrow keys
        if (!player.boostTarget && !keyIsDown(AIM)) {
            player.move(-PLAYER_STATE.moveSpeed, 0);
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

    keyPress(AMMO_CYCLE_BACK, () => {
        if (PLAYER_STATE.availableAmmos.length > 1) {
            const currentIndex = PLAYER_STATE.availableAmmos.indexOf(PLAYER_STATE.ammoElement);
            const nextIndex = currentIndex - 1 > 0 ? currentIndex - 1 : PLAYER_STATE.availableAmmos.length;
            PLAYER_STATE.ammoElement = PLAYER_STATE.availableAmmos[nextIndex];

            ammoText.text = `Weapon: ${spellNames[PLAYER_STATE.ammoElement]}`;
        }
    });

    keyPress(AMMO_CYCLE_FORWARD, () => {
        if (PLAYER_STATE.availableAmmos.length > 1) {
            const currentIndex = PLAYER_STATE.availableAmmos.indexOf(PLAYER_STATE.ammoElement);
            const nextIndex = currentIndex + 1 < PLAYER_STATE.availableAmmos.length ? currentIndex + 1 : 0;
            PLAYER_STATE.ammoElement = PLAYER_STATE.availableAmmos[nextIndex];

            ammoText.text = `Weapon: ${spellNames[PLAYER_STATE.ammoElement]}`;
        }
    });

    player.action(() => {

        if (PLAYER_STATE.health <= 0) {
            destroy(player);
            wait(1, () => {
                go(currentLevel, { currentLevel, previousElement: element, hasRetried: true });
            });
        }

        // If they boosted, give them their boost back when they hit the ground
        if (player.grounded() && PLAYER_STATE.numBoosts < PLAYER_STATE.maxBoosts) {
            PLAYER_STATE.numBoosts++;
            // Update the UI indicator of the number of boosts available
            boostText.text = getBoostIndicators(player);
        }

        if (player.boostTarget) {
            // Create a cool shrinking trail
            const boostTrailSquare = add([rect(TILE_UNIT / 2, TILE_UNIT / 2), color(1, 1, 1), pos(player.pos.x - 1, player.pos.y)]);
            boostTrailSquare.action(() => {
                if (boostTrailSquare.width > 0) {
                    boostTrailSquare.width -= 0.5;
                    boostTrailSquare.height -= 0.5;
                }
            });

            wait(0.25, () => {
                destroy(boostTrailSquare);
            });

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
    // TODO: Mark quarter hearts, etc
    // Create a * character for each heart available
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
        "x==============================x",
        "x=                            =x",
        "x=                            =x",
        "x=                          * =x",
        "x=            o           =====x",
        "x=          o ==              =x",
        "x=        o                   =x",
        "x=      o                     =x",
        "x=ooo o                       =x",
        "x====                     oooo=x",
        "x=                 o o    =====x",
        "x=              o  ====       =x",
        "x=            o               =x",
        "x= P         o                =x",
        "x=================######=======x",
        "x                              x",
        "x                              x",
        "x                              x",
        "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    ],
        mapTokenConfig(element)
    );

    const player = addPlayer();

    sceneSetup({ player, element, currentLevel: "one", nextLevel, map });

    // Use the "playerStart" object from the map to set start position
    every("playerStart", (playerStart) => {
        player.pos.x = playerStart.pos.x;
        player.pos.y = playerStart.pos.y;
    });
});

scene("two", ({ previousElement }) => {
    const nextLevel = "three";
    const element = getElement(previousElement);
    const map = addLevel([
        "x========================================================================x",
        "x=                         !!                            %              =x",
        "x=                                           ooooooooooo %              =x",
        "x=                                          ====         %              =x",
        "x=                                           !!          %     ##       =x",
        "x=                                                       %              =x",
        "x=                                                       %     oo     * =x",
        "x= oo                           ==           !!          ================x",
        "x======                    !!                                           =x",
        "x=              ========                                                =x",
        "x=               !!!!!!                             ooo             %%% =x",
        "x=                                                 o   o            %h% =x",
        "x= P      S                            h                      G     %%% =x",
        "x==========######!!!!!!######=======================###==================x",
        "x                                                                        x",
        "x                                                                        x",
        "x                                                                        x",
        "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    ],
        mapTokenConfig(element)
    );

    const player = addPlayer();

    sceneSetup({ player, element, currentLevel: "two", nextLevel, map });
});

scene("three", ({ previousElement }) => {
    const nextLevel = "four";

    // const element = getElement(previousElement);
    // Arachnos is the Earth boss! His lair is always earth
    const element = EARTH;

    const player = addPlayer();

    // Arachnos boss fight:
    const map = addLevel([
        "x=====================================x",
        "x= o h o%          A          %o H o =x",
        "x=%%%%%%%                     %%%%%%%=x",
        "x=                                   =x",
        "x=                                   =x",
        "x=                                   =x",
        "x=                                   =x",
        "x=       ==###==       ==###==       =x",
        "x=                                   =x",
        "x=                                   =x",
        "x=                                   =x",
        "x=           #####===#####           =x",
        "x=                                   =x",
        "x========     !!!!###!!!!    =========x",
        "x=                                   =x",
        "x=                             %   % =x",
        "x= P                          %o% %o%=x",
        "x===========###############===========x",
        "x                                     x",
        "x                                     x",
        "x                                     x",
        "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",

    ],
        mapTokenConfig(element)
    );

    sceneSetup({ player, element, currentLevel: "three", nextLevel, map });
});

scene("four", ({ previousElement, targetMaxBoosts = 2 }) => {
    const nextLevel = "five";
    const element = getElement(previousElement);

    const map = addLevel([
        "x============================================x",
        "x=                                          =x",
        "x=                                  ^       =x",
        "x=                                 ===      =x",
        "x=                                          =x",
        "x=  P                                       =x",
        "x= ===                                      =x",
        "x=                                          =x",
        "x=                                          =x",
        "x=   o                    o                 =x",
        "x=  ===                   =                 =x",
        "x=                                          =x",
        "x=            ++++++++++++++++++++++++++++++=x",
        "x=                                          =x",
        "x=                                          =x",
        "x=     =====                                =x",
        "x=                                          =x",
        "x=            ++###++###++#+   ===       *  =x",
        "x=                                          =x",
        "x=                                #####+++++=x",
        "x=++++++++++++++++++++++++++++++++++++++++++=x",
        "x                                            x",
        "x                                            x",
        "x                                            x",
        "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    ], mapTokenConfig(element));


    const player = addPlayer();

    sceneSetup({ player, element, currentLevel: "four", nextLevel, map, targetMaxBoosts });
});

scene("five", ({ previousElement }) => {
    const nextLevel = "six";
    const element = getElement(previousElement);
    const map = addLevel([
        "x===================================================================x",
        "x=                                                                 =x",
        "x=                                                                 =x",
        "x=     !!!!!!                                                      =x",
        "x=                                                                 =x",
        "x=                                                                 =x",
        "x=                                                       !!!       =x",
        "x=                                                                 =x",
        "x=                  ======   ##########                     #######=x",
        "x=                                                                 =x",
        "x=                                                                 =x",
        "x=                                                                 =x",
        "x=         ===                                                     =x",
        "x=                             ####################################=x",
        "x=    +++      +++   %         #                                   =x",
        "x=                  % %        #                                   =x",
        "x= P               % % %       #                                 * =x",
        "x=====###!!!!!!###========######!!!!!!######################========x",
        "x                                                                   x",
        "x                                                                   x",
        "x                                                                   x",
        "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",

    ],
        mapTokenConfig(element)
    );

    const player = addPlayer();

    sceneSetup({ player, element, currentLevel: "five", nextLevel, map });
});

scene("interlude", ({ currentLevel, previousElement, nextLevel, tookDamage, defeatedEnemy, collectedItem, retried }) => {
    add([
        text(`
        Level ${currentLevel} complete!

        Thief's log:

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




const overrides = (window.location.search.match(/\?levelOverride=(\w*)(?:&elementOverride=(\w*)?)/));
const levelOverride = (overrides || [])[1];
const elementOverride = (overrides || [])[2];

start(levelOverride ? levelOverride : "one", { previousElement: elementOverride || undefined });
